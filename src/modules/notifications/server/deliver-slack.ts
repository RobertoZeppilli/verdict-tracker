import "server-only";
import { z } from "zod";
import { sqliteBoolean } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import {
  createTranslator,
  DEFAULT_LOCALE,
  dictionaryFor,
  type Locale,
  localePath,
  storedLocaleSchema,
} from "@/modules/i18n";
import { releasePath } from "@/modules/releases";
import { NotificationChannelSchema, NotificationEventSchema } from "../domain/events";
import { slackMessage } from "../domain/slack";
import { type PendingSlack, planSlackSend, type SlackRecipient } from "../domain/slack-plan";
import { sendToSlack, type SendToSlack } from "./send-slack";
import { readSlackWebhook } from "./write-notification-settings";

// ⚠️ A Notification older than this is not news any more, so it is never sent: without a window, a
// Developer who pastes a webhook today would be handed a month of Releases they already read on the
// site (`docs/DECISIONI.md`). The ceiling is what keeps one run from holding the cron open.
const WINDOW_DAYS = 7;
const MAX_PER_RUN = 500;

const CandidateSchema = z.array(
  z.object({
    id: z.uuid(),
    // The job asks for the two Release events only, so the Digest cannot reach a line that has a
    // Release in it: the schema says the same thing the query says.
    event: NotificationEventSchema.extract(["featured_release", "notable_release"]),
    version: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
);


// `storedLocaleSchema` and not `localeSchema`: a row saved when the product published five
// languages can name one it does not any more (ADR 0012), and the Digest going out in English is a
// better answer than the job throwing on it.
const SettingsSchema = z.object({ preferred_locale: storedLocaleSchema });

const PreferenceSchema = z.array(
  z.object({ event: NotificationEventSchema, channel: NotificationChannelSchema, enabled: sqliteBoolean }),
);

export type DeliverReport = { pending: number; sent: number; failed: number };

// ⚠️ The site's own address is **handed in** and not read from `@/env`: a module of this project
// never reads the environment, the job that calls it does (the same shape as the GitHub token in
// the Detection). A webhook has no page it was opened from, so the link has to be absolute.
export type DeliverOptions = { siteUrl: string; now?: Date; send?: SendToSlack };

// Sends the Slack message this run earned, one per run (`docs/DECISIONI.md`).
//
// ⚠️ A webhook that answers badly is written down as `failed` and the run ends without an error: a
// revoked webhook is not a broken job, which is a criterion of #172. There is no automatic retry
// either: a `failed` row means this Notification will not be sent again, and what the reader sees
// in `/settings` is the reason, so they fix the webhook rather than wait.
export async function deliverSlack(
  db: Database,
  { siteUrl, now = new Date(), send = sendToSlack }: DeliverOptions,
): Promise<DeliverReport> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // `MAX_PER_RUN` is a ceiling, so the run takes the oldest five hundred not yet sent and leaves the
  // rest to the next one (issue #190).
  const candidates = db
    .prepare(
      `select n.id, n.event, r.version, t.name, t.slug from notifications n
       join releases r on r.id = n.release_id
       join technologies t on t.id = r.technology_id
       where n.event in ('featured_release', 'notable_release') and n.created_at >= ?
         and not exists (
           select 1 from notification_deliveries d where d.notification_id = n.id and d.channel = 'slack'
         )
       order by n.created_at
       limit ?`,
    )
    .all(since, MAX_PER_RUN);

  const pending: PendingSlack[] = CandidateSchema.parse(candidates).map((row) => ({
    notificationId: row.id,
    event: row.event,
    technologyName: row.name,
    slug: row.slug,
    version: row.version,
    url: "",
  }));
  if (pending.length === 0) return { pending: 0, sent: 0, failed: 0 };

  const recipient = await readRecipient(db);
  const one = planSlackSend(withUrls(pending, recipient?.locale ?? DEFAULT_LOCALE, siteUrl), recipient);
  if (!one) return { pending: pending.length, sent: 0, failed: 0 };

  const t = createTranslator(one.locale, dictionaryFor(one.locale));
  const result = await send(one.webhookUrl, slackMessage(t, one.lines));
  const record = db.prepare(
    `insert into notification_deliveries (notification_id, channel, status, error, attempted_at)
     values (?, 'slack', ?, ?, ?)
     on conflict (notification_id, channel) do update
       set status = excluded.status, error = excluded.error, attempted_at = excluded.attempted_at`,
  );
  for (const notificationId of one.notificationIds) {
    record.run(notificationId, result.ok ? "sent" : "failed", result.ok ? null : result.error, now.toISOString());
  }
  const counted = one.notificationIds.length;
  return { pending: pending.length, sent: result.ok ? counted : 0, failed: result.ok ? 0 : counted };
}

// The link is absolute and in the preferred language: a webhook has no page it was opened from, so
// neither the host nor the locale can be read from a request (ADR 0008).
function withUrls(pending: readonly PendingSlack[], locale: Locale, siteUrl: string): PendingSlack[] {
  return pending.map((one) => ({
    ...one,
    url: `${siteUrl}${localePath(locale, releasePath(one.slug, one.version))}`,
  }));
}

// The one channel this copy can send to, or null when there is none. Three single-row reads: the
// tables hold one row each now (issue #210), so none of them can outgrow a page.
async function readRecipient(db: Database): Promise<SlackRecipient | null> {
  // The webhook first: with none there is nothing to send to, and reading the settings and the
  // preferences would be two queries for nothing.
  const webhookUrl = readSlackWebhook(db);
  if (webhookUrl === null) return null;

  // ⚠️ A missing row is the normal state of a webhook saved before `/settings` was ever opened, so
  // the absence is the declared starting point and not an error.
  const settings = db.prepare("select preferred_locale from notification_settings").get();

  // The Plan was read beside this until issue #209, to tell a paid Developer from one inside the
  // trial. Slack is part of the one level of service now, so a webhook is the whole question.
  const saved = db.prepare("select event, channel, enabled from notification_preferences").all();

  return {
    webhookUrl,
    locale: settings === undefined ? DEFAULT_LOCALE : SettingsSchema.parse(settings).preferred_locale,
    preferences: PreferenceSchema.parse(saved),
  };
}

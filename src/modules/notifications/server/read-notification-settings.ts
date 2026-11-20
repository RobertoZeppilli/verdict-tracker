import { z } from "zod";
import { sqliteBoolean } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { DEFAULT_LOCALE, type Locale, storedLocaleSchema } from "@/modules/i18n";
import { NotificationChannelSchema, NotificationEventSchema } from "../domain/events";
import { type Preference, switchedOn } from "../domain/preferences";
import { webhookHint } from "../domain/slack";

const SettingsRowSchema = z.object({
  // `storedLocaleSchema` and not `localeSchema`, which is what a write goes through: a row saved
  // when the product published five languages can name one it does not any more (ADR 0012), and a
  // preference that cannot be honoured reads as the default instead of taking `/settings` down.
  preferred_locale: storedLocaleSchema,
  // The hint and never the URL, which lives in `notification_secrets` (#172).
  slack_webhook_hint: z.string().nullable(),
});

const PreferenceRowSchema = z.array(
  z.object({ event: NotificationEventSchema, channel: NotificationChannelSchema, enabled: sqliteBoolean }),
);

export type NotificationSettings = {
  preferredLocale: Locale;
  // Where the webhook in use points, as `webhookHint` writes it, or null when there is none.
  slackHint: string | null;
  // The webhook is `VERDICT_WEBHOOK_URL`, which wins over the saved one (#291).
  slackFromEnv: boolean;
  // The rows actually saved, plus the Slack ones a webhook in the environment switches on
  // (`switchedOn`). Everything absent is the declared starting point, which `domain/preferences`
  // holds and both this page and the job read through `isEnabled`.
  preferences: Preference[];
};

// Both tables hold the settings of the one person this copy is installed for (issue #210, ADR 0011),
// so neither query names anybody.
//
// ⚠️ A missing `notification_settings` row is the normal state of a copy whose settings have never
// been touched: no trigger creates one (see the migration of #169), so this returns the declared
// starting point instead of treating the absence as an error.
//
// `webhookFromEnv` is `VERDICT_WEBHOOK_URL`, handed in by the page as the job is handed it
// (`deliverSlack`): a module never reads the environment. Only its hint leaves this function.
export async function readNotificationSettings(db: Database, webhookFromEnv?: string): Promise<NotificationSettings> {
  const settings = db.prepare("select preferred_locale, slack_webhook_hint from notification_settings").get();
  const preferences = PreferenceRowSchema.parse(db.prepare("select event, channel, enabled from notification_preferences").all());

  const row = settings === undefined ? null : SettingsRowSchema.parse(settings);
  const fromEnv = webhookFromEnv !== undefined;
  return {
    preferredLocale: row?.preferred_locale ?? DEFAULT_LOCALE,
    slackHint: fromEnv ? webhookHint(webhookFromEnv) : (row?.slack_webhook_hint ?? null),
    slackFromEnv: fromEnv,
    preferences: fromEnv ? switchedOn(preferences) : preferences,
  };
}

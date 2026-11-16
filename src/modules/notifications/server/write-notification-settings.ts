import { z } from "zod";
import type { Database } from "@/modules/db/server";
import type { Locale } from "@/modules/i18n";
import type { Preference } from "../domain/preferences";

// The two writes of `/settings`, as statements and nothing else: the Server Actions around them
// validate the form, which is what cannot be tested without a request, and these are what the
// integration test runs against the real database.
//
// ⚠️ No identity travels in either of them, and none can: the tables hold one row per event and
// channel, and one row full stop, because an installed copy belongs to one person (issue #210,
// ADR 0011). What used to bind a row to a Developer -- the column, the policy and the `with check`
// around it -- went with the login.

export async function writePreference(db: Database, { event, channel, enabled }: Preference): Promise<void> {
  // Upsert on the primary key, so a switch pressed twice is one row with a new value instead of a
  // duplicate key: the table is keyed by event and channel.
  db.prepare(
    `insert into notification_preferences (event, channel, enabled, updated_at) values (?, ?, ?, ?)
     on conflict (event, channel) do update set enabled = excluded.enabled, updated_at = excluded.updated_at`,
  ).run(event, channel, enabled ? 1 : 0, new Date().toISOString());
}

// `singleton` is the primary key of a table that holds one row: it is a column with one legal
// value, so the upsert has a conflict target to name and the second save finds the first.
export async function writePreferredLocale(db: Database, locale: Locale): Promise<void> {
  db.prepare(
    `insert into notification_settings (singleton, preferred_locale, updated_at) values (1, ?, ?)
     on conflict (singleton) do update set preferred_locale = excluded.preferred_locale, updated_at = excluded.updated_at`,
  ).run(locale, new Date().toISOString());
}

// The webhook and its hint travel together but live apart: the URL in `notification_secrets`, which
// an export of the data file leaves out, and the hint beside the settings, which is what the reader
// reads back (#172). Null on both is "remove the webhook".
export async function writeSlackWebhook(db: Database, webhook: { url: string; hint: string } | null): Promise<void> {
  const now = new Date().toISOString();
  db.prepare(
    `insert into notification_secrets (singleton, slack_webhook_url, updated_at) values (1, ?, ?)
     on conflict (singleton) do update set slack_webhook_url = excluded.slack_webhook_url, updated_at = excluded.updated_at`,
  ).run(webhook?.url ?? null, now);

  // The hint second: a hint without its URL would promise a channel that sends nothing, while a URL
  // whose hint did not land sends correctly and prints nothing, which is the better half to fail on.
  db.prepare(
    `insert into notification_settings (singleton, slack_webhook_hint, updated_at) values (1, ?, ?)
     on conflict (singleton) do update set slack_webhook_hint = excluded.slack_webhook_hint, updated_at = excluded.updated_at`,
  ).run(webhook?.hint ?? null, now);
}

const SecretSchema = z.object({ slack_webhook_url: z.string().nullable() });

// The one read of the secret: the job that sends and the test button of `/settings`.
export function readSlackWebhook(db: Database): string | null {
  const row = db.prepare("select slack_webhook_url from notification_secrets").get();
  return row === undefined ? null : SecretSchema.parse(row).slack_webhook_url;
}

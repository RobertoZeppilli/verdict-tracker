"use server";

import { serverEnv } from "@/env/server";
import { getDatabase } from "@/modules/db/server";
import { createTranslator, dictionaryFor } from "@/modules/i18n";
import type { TestSent } from "@/modules/notifications";
import { readNotificationSettings, readSlackWebhook, sendToSlack } from "@/modules/notifications/server";

// The proof of delivery (#172): a wrong webhook is otherwise discovered the day it was needed. It
// sends where the job sends, so VERDICT_WEBHOOK_URL first (#291), which is why it lives here, beside
// the environment, and not in the module.
//
// The one place a page reads a webhook, and only to send to it: the answer never carries it.
// It takes no arguments although `SendTest` is called with two: the previous state and the form say
// nothing here, and a parameter that is read by nobody is a parameter somebody will try to trust.
export async function sendWebhookTest(): Promise<TestSent> {
  const db = getDatabase();
  const webhook = serverEnv.VERDICT_WEBHOOK_URL ?? readSlackWebhook(db);
  if (webhook === null) return { status: "failed", error: null };

  const { preferredLocale } = await readNotificationSettings(db);
  const t = createTranslator(preferredLocale, dictionaryFor(preferredLocale));
  const result = await sendToSlack(webhook, t("notification.slack.test"));
  return result.ok ? { status: "sent", error: null } : { status: "failed", error: result.error };
}

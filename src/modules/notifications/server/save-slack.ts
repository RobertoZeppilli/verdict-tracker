"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/modules/db/server";
import { createTranslator, dictionaryFor } from "@/modules/i18n";
import type { TestSent, WebhookSaved } from "../domain/saving";
import { isSlackWebhook, webhookHint } from "../domain/slack";
import { sendToSlack } from "./send-slack";
import { readNotificationSettings } from "./read-notification-settings";
import { readSlackWebhook, writeSlackWebhook } from "./write-notification-settings";

// The webhook of `/settings`, in the shape #171 settled for the switches: the form is validated
// here, because a form can be posted without the page.
//
// ⚠️ The answer carries the **hint** and never the URL: the reader writes their webhook and from
// then on reads only where it points (#172, and the read grant that makes it true).
export async function saveSlackWebhook(previous: WebhookSaved, form: FormData): Promise<WebhookSaved> {
  const raw = form.get("webhook");
  if (typeof raw !== "string") return { status: "failed", hint: previous.hint };
  const url = raw.trim();

  const db = getDatabase();

  // An empty field is "remove it", which is the way back out: whoever pasted the wrong webhook must
  // not have to find a right one to stop sending to it.
  if (url === "") {
    try {
      await writeSlackWebhook(db, null);
    } catch {
      return { status: "failed", hint: previous.hint };
    }
    // The page draws things that depend on there being a channel -- the language Slack is written
    // in (#194) -- so the route is revalidated: the answer below moves the hint, not the page.
    revalidatePath("/[locale]/settings", "page");
    return { status: "saved", hint: null };
  }

  // Another host would be this reader's secret posted to somebody else's server. The database
  // refuses it as well, because this check is not the only door to the row.
  if (!isSlackWebhook(url)) return { status: "failed", hint: previous.hint };

  const hint = webhookHint(url);
  try {
    await writeSlackWebhook(db, { url, hint });
  } catch {
    return { status: "failed", hint: previous.hint };
  }
  revalidatePath("/[locale]/settings", "page");
  return { status: "saved", hint };
}

// The proof of delivery (#172): a wrong webhook is otherwise discovered the day it was needed.
//
// The one place a page reads a webhook, and only to send to it: the answer never carries it.
// It takes no arguments although `SendTest` is called with two: the previous state and the form say
// nothing here, and a parameter that is read by nobody is a parameter somebody will try to trust.
export async function sendSlackTest(): Promise<TestSent> {
  const db = getDatabase();
  const webhook = readSlackWebhook(db);
  if (webhook === null) return { status: "failed", error: null };

  const { preferredLocale } = await readNotificationSettings(db);
  const t = createTranslator(preferredLocale, dictionaryFor(preferredLocale));
  const result = await sendToSlack(webhook, t("notification.slack.test"));
  return result.ok ? { status: "sent", error: null } : { status: "failed", error: result.error };
}

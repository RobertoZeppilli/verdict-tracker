"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/modules/db/server";
import type { WebhookSaved } from "../domain/saving";
import { isWebhook, webhookHint } from "../domain/slack";
import { writeSlackWebhook } from "./write-notification-settings";

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

  // Slack or Discord (#244). Another host would be this reader's secret posted to somebody else's server. The database
  // refuses it as well, because this check is not the only door to the row.
  if (!isWebhook(url)) return { status: "failed", hint: previous.hint };

  const hint = webhookHint(url);
  try {
    await writeSlackWebhook(db, { url, hint });
  } catch {
    return { status: "failed", hint: previous.hint };
  }
  revalidatePath("/[locale]/settings", "page");
  return { status: "saved", hint };
}

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  deliverSlack,
  generateNotifications,
  readNotificationSettings,
  writeSlackWebhook,
} from "@/modules/notifications/server";
import type { SendResult } from "@/modules/notifications/server";
import { type Content, seedContent, testDatabase } from "./database";

const SITE = "https://example.test";
const GOOD = "https://hooks.slack.com/services/T0/B0/good";
const BROKEN = "https://hooks.slack.com/services/T0/B0/brok";

const DeliveryRowsSchema = z.array(
  z.object({ notification_id: z.uuid(), channel: z.string(), status: z.string(), error: z.string().nullable() }),
);

const db = testDatabase();
let content: Content;

// A Slack that answers: it takes everything but the one webhook that is meant to be broken, which is
// how a revoked webhook behaves in life. What it was asked to send is kept, so the test can read the
// one message a run produced instead of guessing at it.
function fakeSlack() {
  const sent: { url: string; text: string }[] = [];
  return {
    sent,
    send: async (url: string, text: string): Promise<SendResult> => {
      sent.push({ url, text });
      return url === BROKEN ? { ok: false, error: "invalid_token" } : { ok: true };
    },
  };
}

function switchSlackOn(): void {
  db.prepare(
    `insert into notification_preferences (event, channel, enabled) values ('featured_release', 'slack', 1)
     on conflict (event, channel) do update set enabled = 1`,
  ).run();
}

function deliveries() {
  return DeliveryRowsSchema.parse(db.prepare("select notification_id, channel, status, error from notification_deliveries").all());
}

beforeAll(() => {
  content = seedContent(db);
  db.prepare("insert into follows (technology_id) values (?)").run(content.technologyId);
  db.prepare(
    "update summaries set status = 'ready', content = ?, model = 'claude-opus-5', prompt_version = 'v1' where release_id = ?",
  ).run(JSON.stringify({ title: "Nothing here is read.", keyPoints: [] }), content.releaseId);
});

beforeEach(async () => {
  db.exec("delete from notification_deliveries; delete from notifications; delete from notification_preferences");
  await writeSlackWebhook(db, { url: GOOD, hint: "hooks.slack.com/…good" });
  switchSlackOn();
  await generateNotifications(db);
});

// The URL has a table of its own, so an export of the settings leaves it out (#172): what is read
// back is the hint, and the URL only by the job that posts to it.
describe("the webhook as a secret", () => {
  it("keeps the URL out of the settings, which hold the hint", async () => {
    expect(db.prepare("select slack_webhook_url from notification_secrets").get()).toEqual({ slack_webhook_url: GOOD });
    expect((await readNotificationSettings(db)).slackHint).toBe("hooks.slack.com/…good");
    expect(JSON.stringify(db.prepare("select * from notification_settings").all())).not.toContain(GOOD);
  });
});

describe("deliverSlack", () => {
  it("gathers the run into one message, to the saved webhook", async () => {
    const slack = fakeSlack();
    const report = await deliverSlack(db, { siteUrl: SITE, send: slack.send });

    expect(report.sent).toBe(1);
    expect(report.failed).toBe(0);
    expect(slack.sent.map((one) => one.url)).toEqual([GOOD]);
    expect(await deliveries()).toMatchObject([{ channel: "slack", status: "sent", error: null }]);
  });

  // ⚠️ A revoked webhook is written down and the run ends without an error: a `failed` row is what
  // `/settings` then prints, so the reason is read there rather than waited for (#172).
  it("writes down what a broken webhook answered, without failing the run", async () => {
    await writeSlackWebhook(db, { url: BROKEN, hint: "hooks.slack.com/…brok" });
    const slack = fakeSlack();
    const report = await deliverSlack(db, { siteUrl: SITE, send: slack.send });

    expect(report.failed).toBe(1);
    expect(await deliveries()).toMatchObject([
      { channel: "slack", status: "failed", error: "invalid_token" },
    ]);
  });

  it("sends nothing a second time: the delivery is what makes the run idempotent", async () => {
    const first = fakeSlack();
    await deliverSlack(db, { siteUrl: SITE, send: first.send });
    const second = fakeSlack();
    const report = await deliverSlack(db, { siteUrl: SITE, send: second.send });

    expect(second.sent).toEqual([]);
    expect(report.pending).toBe(0);
  });

  it("sends nothing once the webhook is removed", async () => {
    await writeSlackWebhook(db, null);
    const slack = fakeSlack();
    await deliverSlack(db, { siteUrl: SITE, send: slack.send });

    expect(slack.sent).toEqual([]);
    expect(await deliveries()).toEqual([]);
  });

  it("writes the message in the preferred language, with the grammar in English", async () => {
    db.exec("update notification_settings set preferred_locale = 'it'");

    const slack = fakeSlack();
    await deliverSlack(db, { siteUrl: SITE, send: slack.send });
    const message = slack.sent.find((one) => one.url === GOOD)?.text ?? "";

    expect(message).toContain("Release");
    expect(message).toContain("featured ·");
  });
});

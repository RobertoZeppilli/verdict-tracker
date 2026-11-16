import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_LOCALE } from "@/modules/i18n";
import {
  generateNotifications,
  pruneNotifications,
  readFeed,
  readNotificationSettings,
  readUnseen,
  RETENTION_DAYS,
  writePreference,
  writePreferredLocale,
  writeSeen,
} from "@/modules/notifications/server";
import { clearFollows, type Content, seedContent, testDatabase } from "./database";

const NotificationRowsSchema = z.array(
  z.object({ id: z.uuid(), event: z.string(), release_id: z.uuid().nullable(), seen_at: z.string().nullable() }),
);

// A Notification, a preference and the preferred language belong to the installed copy and not to
// an account (issue #210, ADR 0011): one reader, and the tables to match.
const db = testDatabase();
let content: Content;

// The Release seeded for these tests is `featured`; its Summary starts `pending`, which is the state
// in which no Notification is due yet. The provenance travels with the status because
// `summaries_ready_provenance` refuses a `ready` row that does not say where it came from.
function setSummaryStatus(status: string): void {
  const ready = status === "ready";
  db.prepare("update summaries set status = ?, content = ?, model = ?, prompt_version = ? where release_id = ?").run(
    status,
    ready ? JSON.stringify({ title: "Nothing here is read.", keyPoints: [] }) : null,
    ready ? "claude-opus-5" : null,
    ready ? "v1" : null,
    content.releaseId,
  );
}

function follow(): void {
  db.prepare("insert into follows (technology_id) values (?)").run(content.technologyId);
}

function notifications() {
  return NotificationRowsSchema.parse(db.prepare("select id, event, release_id, seen_at from notifications").all());
}

beforeAll(() => {
  content = seedContent(db);
  follow();
});

beforeEach(() => {
  db.exec("delete from notifications; delete from notification_preferences");
  setSummaryStatus("pending");
});

describe("generateNotifications", () => {
  it("writes nothing while the Summary is still coming", async () => {
    const report = await generateNotifications(db);
    expect(report.planned).toBe(0);
    expect(notifications()).toEqual([]);
  });

  it("writes one for a Release of a followed Technology", async () => {
    setSummaryStatus("ready");
    await generateNotifications(db);

    const written = notifications();
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ event: "featured_release", release_id: content.releaseId });
  });

  it("writes none when the Technology is not followed", async () => {
    clearFollows(db);
    setSummaryStatus("ready");
    await generateNotifications(db);
    expect(notifications()).toEqual([]);
    follow();
  });

  it("writes one even when the Summary will never arrive", async () => {
    setSummaryStatus("unavailable");
    await generateNotifications(db);
    expect(notifications()).toHaveLength(1);
  });

  it("does not duplicate when the job runs twice", async () => {
    setSummaryStatus("ready");
    await generateNotifications(db);
    await generateNotifications(db);
    expect(notifications()).toHaveLength(1);
  });

  it("respects the event switched off on every channel", async () => {
    setSummaryStatus("ready");
    for (const channel of ["in_app", "slack", "email"]) {
      db.prepare("insert into notification_preferences (event, channel, enabled) values ('featured_release', ?, 0)").run(
        channel,
      );
    }
    await generateNotifications(db);
    expect(notifications()).toEqual([]);
  });
});

// What `/api/notifications` answers the bell with (issue #211).
describe("the bell", () => {
  beforeEach(async () => {
    setSummaryStatus("ready");
    await generateNotifications(db);
  });

  it("counts and lists the unseen Release events", () => {
    expect(readUnseen(db)).toBe(1);
    const [item] = readFeed(db);
    expect(item).toMatchObject({ event: "featured_release", version: "1.0.0", seen: false });
  });

  // The weekly Digest has no line in the panel yet (#173), so it is neither counted nor listed.
  it("leaves the weekly Digest out of both", () => {
    db.prepare("insert into notifications (event, digest_week) values ('weekly_digest', '2026-W43')").run();
    expect(readUnseen(db)).toBe(1);
    expect(readFeed(db)).toHaveLength(1);
  });

  it("marks one Seen, and keeps the day it was first Seen", async () => {
    const [one] = notifications();
    writeSeen(db, one.id);
    const first = notifications()[0].seen_at;
    expect(first).not.toBeNull();
    expect(readUnseen(db)).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 5));
    writeSeen(db, one.id);
    expect(notifications()[0].seen_at).toBe(first);
  });

  it("marks every unseen one Seen when no id is given", () => {
    writeSeen(db, null);
    expect(readUnseen(db)).toBe(0);
    expect(readFeed(db).every((item) => item.seen)).toBe(true);
  });
});

// What `/settings` writes and reads back (issue #171). The statements are the ones the Server Actions
// run: what the action adds around them is the validation of the form.
describe("the Notification settings saved on this copy", () => {
  beforeEach(() => {
    db.exec("delete from notification_settings");
  });

  it("reads the declared starting point while nothing was ever saved", async () => {
    expect(await readNotificationSettings(db)).toEqual({
      preferredLocale: DEFAULT_LOCALE,
      // No webhook saved, which is what keeps the Slack switches of #172 sending nothing.
      slackHint: null,
      preferences: [],
    });
  });

  it("holds a switch across a reload, and the job obeys it", async () => {
    await writePreference(db, { event: "featured_release", channel: "in_app", enabled: false });

    // The reload: a second read, with nothing kept in between.
    const settings = await readNotificationSettings(db);
    expect(settings.preferences).toEqual([{ event: "featured_release", channel: "in_app", enabled: false }]);

    setSummaryStatus("ready");
    await generateNotifications(db);
    expect(notifications()).toEqual([]);
  });

  it("writes one row however many times the switch is pressed", async () => {
    for (const enabled of [false, true, false]) {
      await writePreference(db, { event: "notable_release", channel: "in_app", enabled });
    }
    expect((await readNotificationSettings(db)).preferences).toEqual([
      { event: "notable_release", channel: "in_app", enabled: false },
    ]);
  });

  it("saves the preferred language, creating the row, and reads it back", async () => {
    await writePreferredLocale(db, "it");
    expect((await readNotificationSettings(db)).preferredLocale).toBe("it");
    await writePreferredLocale(db, "en");
    expect((await readNotificationSettings(db)).preferredLocale).toBe("en");
  });

  // The `singleton` primary key is what says the settings are one row (issue #210).
  it("keeps the settings to one row however often they are saved", async () => {
    await writePreferredLocale(db, "en");
    await writePreferredLocale(db, "it");
    expect(db.prepare("select preferred_locale from notification_settings").all()).toEqual([
      { preferred_locale: "it" },
    ]);
  });
});

describe("pruneNotifications", () => {
  it("deletes what is older than the retention and keeps the rest", async () => {
    const old = new Date(Date.now() - (RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      "insert into notifications (event, digest_week, created_at) values ('weekly_digest', '2020-W01', ?), ('weekly_digest', '2026-W43', ?)",
    ).run(old, new Date().toISOString());

    expect(await pruneNotifications(db)).toBe(1);
    expect(notifications().map((row) => row.event)).toEqual(["weekly_digest"]);
  });
});

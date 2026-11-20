import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";
import type { Category } from "@/modules/catalog";
// The file and not the module's index: the index is `server-only`, which Playwright cannot load.
// eslint-disable-next-line no-restricted-imports -- see the line above
import { type Database, defaultDatabaseFile, defaultStateFile, openDatabase } from "@/modules/db/server/open-database";
import type { SummaryContent } from "@/modules/summaries";

// The data file the app under test reads: `playwright.config.ts` points both at `.e2e-data/`, so
// the fixtures never write into a real install. Opened once per worker; WAL and `busy_timeout` let
// it share the file with the app's own connection.
let connection: Database | null = null;

function db(): Database {
  connection ??= openDatabase({ file: defaultDatabaseFile() });
  return connection;
}

export type FixtureRelease = {
  version: string;
  significance: "featured" | "notable" | "digest" | "preview";
  origin: "imported" | "detected";
  status: "pending" | "processing" | "ready" | "unavailable" | "skipped" | "failed";
  notes: string | null;
  // The Dashboard looks back 30 days, so its tests need a Release dated near the run.
  publishedAt?: Date;
  // Only for a `ready` Summary: the verdict the Upgrade Path counts, with a generic content around it.
  actionRequired?: boolean;
  // Only for a `ready` Summary: stored as is, even if it does not validate.
  summary?: SummaryContent | Record<string, unknown>;
};

function contentFor(release: FixtureRelease): unknown {
  if (release.summary !== undefined) return release.summary;
  if (release.actionRequired === undefined) return null;
  return {
    title: `Fixture ${release.version} release.`,
    keyPoints: [{ text: "A first change." }, { text: "A second change." }, { text: "A third change." }],
    breakingChanges: release.actionRequired ? [{ change: "The default export is gone", migration: "Use the named export." }] : [],
    actionRequired: release.actionRequired,
  };
}

export type FixtureTechnology = {
  id: string;
  slug: string;
  name: string;
  repo: string;
  remove: () => Promise<void>;
};

// A Technology of its own for each run, so pages cached by earlier runs never interfere.
export async function seedTechnology(
  releases: FixtureRelease[],
  // Every Technology has a Category, and the picker groups the Catalog by it: a fixture declares its
  // own so a test can say which group its row belongs to.
  { retired = false, category = "library" }: { retired?: boolean; category?: Category } = {},
): Promise<FixtureTechnology> {
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const name = `Fixture ${slug.slice(4)}`;
  const repo = `fixture/${slug}`;
  const technologyId = randomUUID();

  db()
    .prepare(
      "insert into technologies (id, slug, name, category, classification_strategy, retired) values (?, ?, ?, ?, 'semver', ?)",
    )
    .run(technologyId, slug, name, category, retired ? 1 : 0);
  const source = db().prepare("insert into sources (technology_id, role, kind, config) values (?, ?, ?, ?)");
  source.run(technologyId, "detection", "npm", JSON.stringify({ package: slug }));
  source.run(technologyId, "notes", "github-releases", JSON.stringify({ repo, tagFormat: "v{version}" }));

  for (const [index, release] of releases.entries()) {
    const releaseId = randomUUID();
    const publishedAt = release.publishedAt ?? new Date(Date.UTC(2026, 0, 10 + index));
    db()
      .prepare(
        "insert into releases (id, technology_id, version, significance, origin, published_at) values (?, ?, ?, ?, ?, ?)",
      )
      .run(releaseId, technologyId, release.version, release.significance, release.origin, publishedAt.toISOString());
    if (release.notes !== null) {
      const url = `https://github.com/${repo}/releases/tag/v${release.version}`;
      db().prepare("insert into release_notes (release_id, body, url) values (?, ?, ?)").run(releaseId, release.notes, url);
    }
    const content = contentFor(release);
    const ready = release.status === "ready";
    db()
      .prepare("insert into summaries (release_id, status, content, model, prompt_version) values (?, ?, ?, ?, ?)")
      .run(
        releaseId,
        release.status,
        content === null ? null : JSON.stringify(content),
        ready ? "claude-opus-5" : null,
        ready ? "v1" : null,
      );
  }

  // Children before parents: a Notification points at a Release, and a test that pressed the Toggle
  // can have left a follow on the Technology.
  async function remove() {
    const releasesOf = "select id from releases where technology_id = ?";
    for (const table of ["notification_deliveries", "notifications", "summaries", "release_notes"]) {
      const column = table === "notification_deliveries" ? "notification_id" : "release_id";
      const scope =
        table === "notification_deliveries"
          ? `select id from notifications where release_id in (${releasesOf})`
          : releasesOf;
      db().prepare(`delete from ${table} where ${column} in (${scope})`).run(technologyId);
    }
    for (const table of ["follows", "releases", "sources"]) {
      db().prepare(`delete from ${table} where technology_id = ?`).run(technologyId);
    }
    db().prepare("delete from technologies where id = ?").run(technologyId);
  }

  return { id: technologyId, slug, name, repo, remove };
}

export type FixtureFillers = { ids: string[]; remove: () => Promise<void> };

// Technologies with nothing in them, only there to give the Catalog rows to press: the picker shows
// a row for each, and a name of their own keeps them out of the way of a filter looking for another
// fixture. A Category of their own, so the fillers never crowd the group a test is looking at.
export async function seedFillers(count: number): Promise<FixtureFillers> {
  const insert = db().prepare(
    "insert into technologies (id, slug, name, category, classification_strategy) values (?, ?, ?, 'platform', 'semver')",
  );
  const ids = Array.from({ length: count }, () => {
    const id = randomUUID();
    const slug = `filler-${id.slice(0, 8)}`;
    insert.run(id, slug, `Filler ${slug.slice(7)}`);
    return id;
  });

  return {
    ids,
    remove: async () => {
      for (const id of ids) {
        db().prepare("delete from follows where technology_id = ?").run(id);
        db().prepare("delete from technologies where id = ?").run(id);
      }
    },
  };
}

// The Follow Toggle answers before the database does, and says so with `aria-busy` while the write is
// on its way (`follows-provider.tsx`). A test that then asks the server what it holds, with a reload
// or with a declaration written on the follow, waits for that to go: the button has already changed
// its mind, the row has not. The toggle to pass is the one the press leaves behind, so waiting for it
// also waits for the optimistic answer.
export async function followWritten(toggle: Locator): Promise<void> {
  await expect(toggle).not.toHaveAttribute("aria-busy", "true");
}

// A follow written from outside the browser: what a second tab would leave behind.
export async function addFollows(technologyIds: readonly string[]): Promise<void> {
  const insert = db().prepare("insert into follows (technology_id) values (?)");
  for (const technologyId of technologyIds) insert.run(technologyId);
}

// ⚠️ **One table for the whole suite.** Since issue #210 a follow belongs to the installed copy and
// not to an account, so there is no Developer of its own to isolate a test any more: a test that
// writes follows clears them, or it hands the next one its leftovers.
export async function clearFollows(): Promise<void> {
  db().exec("delete from follows");
}

// A Version in use declared from outside the browser, with the day the app would write.
export async function declareCurrentVersion(technologyId: string, version: string): Promise<void> {
  db()
    .prepare(
      "update follows set current_version = ?, current_version_declared_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where technology_id = ?",
    )
    .run(version, technologyId);
}

// A Technology leaves the Catalog while it is followed: the only way a retired follow can exist.
export async function retireTechnology(technologyId: string): Promise<void> {
  db().prepare("update technologies set retired = 1 where id = ?").run(technologyId);
}

// The app reads the secret from .env.local, which the Playwright process does not load.
export function e2eAuthSecret(): string {
  const fromEnv = process.env.E2E_AUTH_SECRET;
  if (fromEnv) return fromEnv;
  // Playwright runs from the repository root.
  const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of file.split("\n")) {
    const [name, ...rest] = line.trim().split("=");
    if (name === "E2E_AUTH_SECRET" && rest.length > 0) return rest.join("=");
  }
  throw new Error("E2E_AUTH_SECRET is not set: add it to .env.local (see .env.example).");
}

// ⚠️ **The page has arrived, as opposed to the wait for it.** `/dashboard` and `/technologies` sit
// behind a loading boundary, so the framework streams the wait first and the page after it, and for
// a moment the document holds **both**: the skeleton, visible, and the real page, hidden, waiting to
// be swapped in. `page.goto` resolves on `load`, which is inside that moment, so a test that asserts
// on content is safe (the locator waits) while a test that **measures geometry** right after `goto`
// can measure the wait instead. That is what it did: against the production build, seven E2E read
// `locator("header")` as two elements and failed on `main` on 2026-10-15, deterministically, three
// attempts each. Call this between the navigation and the first measurement.
export async function arrived(page: Page): Promise<void> {
  await expect(page.locator('[data-waiting="page"]')).toHaveCount(0);
}

// ⚠️ **The page forgets its render.** `/technologies/[slug]` is `revalidate = false`, so the
// first render of a slug is served indefinitely: a test that writes to a Technology and then reads
// its page can be handed the page from before the write, byte for byte, with `x-nextjs-cache: HIT`.
// Measured in issue #178, where the test pressed a retired Technology that the page still offered a
// Follow for; inside the full suite a prefetch from the Catalog is enough to have warmed it, and
// alone nothing warms it, which is why the test passed 44 runs by itself. `route` is the pattern and
// not one path, so one call reaches every slug in every language.
export async function forgetRender(page: Page, route: string): Promise<void> {
  // A write without the app's Origin is refused by the proxy (#239); a browser sends it, Playwright not.
  const origin = String(test.info().project.use.baseURL);
  const response = await page.request.post("/api/test/revalidate", {
    data: { secret: e2eAuthSecret(), route },
    headers: { origin },
  });
  expect(response.status(), "the test-only revalidation route answered").toBe(204);
}

// ⚠️ **The control answers, as opposed to being on the page.** A Follow Toggle is a
// `type="button"` with a handler and no form behind it, so until React has hydrated it a press does
// **nothing at all**, and it leaves no trace: the test goes on to wait for an effect that will never
// come and fails on the assertion after the click, five seconds later and somewhere else. That is
// issue #178, where `technology-follow.spec.ts` passed 44 runs alone and failed inside the full
// suite, and where throttling the CPU 20x reproduces it every time: `page.goto` resolves on `load`,
// which says the scripts arrived, never that they have run. React writes its own keys onto every
// element it hydrates, so whether this button is wired yet is a question the page can answer.
// Call this before the first press of a client control, not before an assertion: a locator that
// only reads waits by itself.
export async function wired(locator: Locator): Promise<void> {
  await expect(async () => {
    const hydrated = await locator.evaluate((node: Element) =>
      Object.keys(node).some((key) => key.startsWith("__react")),
    );
    expect(hydrated, "React has hydrated the control").toBe(true);
  }).toPass();
}

// ⚠️ **The box as layout has it, and of the element the document actually holds.** The
// Technology page replaces its whole tree once shortly after `load` (its `h1` is built twice, which
// an observer in the page counted), so the node a locator resolved a moment earlier can already be
// detached, and a detached element measures 0 in every direction:
// `boundingBox()` answers `null`, `getBoundingClientRect()` answers zeros, and the live element
// beside it has the right number all along. That is issue #178, where a mark 24px wide was read as
// `undefined` in 17 runs out of 20 against the production build. What is retried here is **which
// element is measured**, never the number it gives: the measurement itself is asserted once, by the
// test, against the threshold `DESIGN.md` sets.
export async function boxOf(locator: Locator): Promise<{ width: number; height: number; top: number; left: number }> {
  let box = { width: 0, height: 0, top: 0, left: 0 };

  await expect(async () => {
    const seen = await locator.evaluate((node: Element) => {
      const rect = node.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        connected: node.isConnected,
      };
    });
    expect(seen.connected, "the element measured is still the one on the page").toBe(true);
    box = { width: seen.width, height: seen.height, top: seen.top, left: seen.left };
  }).toPass();

  return box;
}

// What the database holds, as opposed to what the page says about it.
export async function countFollows(): Promise<number> {
  return z.object({ count: z.number() }).parse(db().prepare("select count(*) as count from follows").get()).count;
}

// A Notification written from outside the browser, which is what the job does (issue #169). The
// bell's tests need rows without running the job: the job reads Releases, follows and preferences,
// and what the panel is about is none of those.
export async function addNotification(
  releaseId: string,
  event: "featured_release" | "notable_release" = "featured_release",
): Promise<void> {
  db().prepare("insert into notifications (event, release_id) values (?, ?)").run(event, releaseId);
}

// Notifications outlive a test, like follows: a suite starts each test from none.
export async function clearNotifications(): Promise<void> {
  db().exec("delete from notification_deliveries; delete from notifications");
}

// What the database holds, as opposed to what the bell says: the counter answers before the write
// lands, so the proof that a press was written is a read of the file.
export async function countUnseen(): Promise<number> {
  const row = db().prepare("select count(*) as count from notifications where seen_at is null").get();
  return z.object({ count: z.number() }).parse(row).count;
}

// The Notification settings: what `/settings` saved is proved against the database and not against
// the page that saved it (issue #171). The Slack webhook lives in a table of its own (#172): without
// it a webhook saved by one test would still be there for the next one.
export async function clearNotificationSettings(): Promise<void> {
  db().exec("delete from notification_settings; delete from notification_preferences; delete from notification_secrets");
}

// Null when that pair was never saved, which is the declared starting point and not "off".
export async function savedPreference(event: string, channel: string): Promise<boolean | null> {
  const row = db()
    .prepare("select enabled from notification_preferences where event = ? and channel = ?")
    .get(event, channel);
  return row === undefined ? null : z.object({ enabled: z.number() }).parse(row).enabled === 1;
}

export async function savedLocale(): Promise<string | null> {
  const row = db().prepare("select preferred_locale from notification_settings").get();
  return row === undefined ? null : z.object({ preferred_locale: z.string() }).parse(row).preferred_locale;
}

// The Release a fixture's Version was given, which a Notification has to point at.
export async function releaseIdFor(technologyId: string, version: string): Promise<string> {
  const row = db().prepare("select id from releases where technology_id = ? and version = ?").get(technologyId, version);
  return z.object({ id: z.uuid() }).parse(row).id;
}

// `verdict.json` of `.e2e-data`, where `/settings` saves the vault (issue #244).
export function stateFile(): string {
  return defaultStateFile();
}

// The vault taken out of it again, so no later test writes notes.
export function clearVault(): void {
  const file = defaultStateFile();
  if (!existsSync(file)) return;
  const state = z.record(z.string(), z.unknown()).parse(JSON.parse(readFileSync(file, "utf8")));
  delete state.vault;
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

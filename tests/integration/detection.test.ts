import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { StoredTechnology } from "@/modules/catalog";
import { getTechnology } from "@/modules/catalog/server";
import type { ObservedVersion, SourceAdapters } from "@/modules/detection";
import { detectReleases } from "@/modules/detection/server";
import { seedTechnology, testDatabase } from "./database";

// A pair of npm Sources reporting the same package, plus GitHub Releases for the notes: two
// detection Sources are how the test sees that one Version still makes exactly one Release.
const published: ObservedVersion[] = [];
const asked: string[] = [];
let etag: string | null = null;
// The Detection walks every Technology in the database, and a developer's database holds the whole
// Catalog: a fake that answered for all of them would put this test's Versions on Storybook too.
const mine = new Set<string>();

const adapters: SourceAdapters = {
  async listVersions(source, sent) {
    const name = source.kind === "npm" ? source.package : source.repo;
    if (!mine.has(name)) return { etag: null, versions: [] };
    asked.push(`versions ${name} ${sent ?? "-"}`);
    if (etag !== null && sent === etag) return "unchanged";
    return { etag, versions: published.map((version) => ({ ...version })) };
  },
  async findNotes(source, versions) {
    asked.push(`notes ${source.repo}`);
    return new Map(
      versions.map((version) => [
        version,
        { body: `### Changes for ${version}`, url: `https://github.com/${source.repo}/releases/tag/v${version}` },
      ]),
    );
  },
};

const ReleaseSchema = z.array(
  z.object({
    version: z.string(),
    significance: z.string(),
    significance_override: z.string().nullable(),
    origin: z.string(),
    status: z.string().nullable(),
  }),
);

const db = testDatabase();
let technology: StoredTechnology;
let retired: StoredTechnology;

function readReleases(technologyId: string) {
  const rows = db
    .prepare(
      `select r.version, r.significance, r.significance_override, r.origin, s.status
       from releases r left join summaries s on s.release_id = r.id
       where r.technology_id = ? order by r.version`,
    )
    .all(technologyId);
  return ReleaseSchema.parse(rows).map(({ status, ...release }) => ({
    ...release,
    summaries: status === null ? null : { status },
  }));
}

async function seed(prefix: string, sources: Parameters<typeof seedTechnology>[1]["sources"], retiredTechnology = false) {
  const slug = `${prefix}-${randomUUID()}`;
  seedTechnology(db, { slug, name: "Detection test", retired: retiredTechnology, sources });
  const stored = await getTechnology(db, slug);
  if (!stored) throw new Error("seeded Technology not found");
  return stored;
}

// The Detection only extends a Technology that already has Releases: the Initial Import decides
// where its history starts, so the test gives it one.
function seedRelease(technologyId: string, version: string, significance: string, publishedAt: string) {
  const releaseId = randomUUID();
  db.prepare(
    "insert into releases (id, technology_id, version, significance, origin, published_at) values (?, ?, ?, ?, 'imported', ?)",
  ).run(releaseId, technologyId, version, significance, publishedAt);
  // Issue #88: a ready Summary carries its content and its provenance, or the database refuses it.
  // This one is only here so the Release looks settled; what it says is never read.
  db.prepare(
    "insert into summaries (release_id, status, content, model, prompt_version) values (?, 'ready', ?, 'claude-opus-5', 'v4')",
  ).run(
    releaseId,
    JSON.stringify({
      title: "Nothing here is read by this test.",
      keyPoints: [{ text: "One." }, { text: "Two." }, { text: "Three." }],
      breakingChanges: [],
      actionRequired: false,
    }),
  );
  return releaseId;
}

beforeAll(async () => {
  const slug = randomUUID();
  mine.add(slug).add(`retired-${slug}`);
  technology = await seed("detect", [
    { role: "detection", kind: "npm", config: { package: slug } },
    { role: "notes", kind: "github-releases", config: { repo: `test/${slug}`, tagFormat: "v{version}" } },
  ]);
  seedRelease(technology.id, "1.0.0", "featured", "2026-01-01T00:00:00Z");

  retired = await seed("retired", [{ role: "detection", kind: "npm", config: { package: `retired-${slug}` } }], true);
  seedRelease(retired.id, "1.0.0", "featured", "2026-01-01T00:00:00Z");
});

beforeEach(() => {
  published.length = 0;
  asked.length = 0;
  etag = null;
});

describe("Detection", () => {
  it("registers a new Version as a detected Release with its notes", async () => {
    published.push({ version: "1.1.0", publishedAt: new Date("2026-02-01T00:00:00Z") });
    const report = await detectReleases(db, adapters);

    expect(report.detected).toContainEqual({ slug: technology.slug, version: "1.1.0" });
    expect(await readReleases(technology.id)).toContainEqual(
      expect.objectContaining({ version: "1.1.0", significance: "notable", origin: "detected" }),
    );
  });

  it("creates no duplicate when the same Version comes back", async () => {
    published.push({ version: "1.1.0", publishedAt: new Date("2026-02-01T00:00:00Z") });
    const before = await readReleases(technology.id);
    const report = await detectReleases(db, adapters);

    expect(report.detected).toEqual([]);
    expect(await readReleases(technology.id)).toEqual(before);
  });

  it("never asks a retired Technology", async () => {
    await detectReleases(db, adapters);
    expect(asked.some((call) => call.includes("retired-"))).toBe(false);
  });

  it("leaves out canary, nightly and experimental builds", async () => {
    published.push(
      { version: "1.2.0-canary.3", publishedAt: new Date("2026-03-01T00:00:00Z") },
      { version: "1.2.0-nightly.20260301", publishedAt: new Date("2026-03-01T00:00:00Z") },
      { version: "1.2.0-experimental-abc1234", publishedAt: new Date("2026-03-01T00:00:00Z") },
      { version: "1.2.0-alpha.1", publishedAt: new Date("2026-03-01T00:00:00Z") },
    );
    await detectReleases(db, adapters);

    const versions = (await readReleases(technology.id)).map((release) => release.version);
    expect(versions.filter((version) => version.startsWith("1.2.0-"))).toEqual([]);
  });

  it("summarizes the first Preview of a new major and skips the ones after it", async () => {
    published.push(
      { version: "2.0.0-beta.0", publishedAt: new Date("2026-04-01T00:00:00Z") },
      { version: "2.0.0-rc.0", publishedAt: new Date("2026-04-10T00:00:00Z") },
    );
    await detectReleases(db, adapters);

    const releases = await readReleases(technology.id);
    expect(releases).toContainEqual(
      expect.objectContaining({ version: "2.0.0-beta.0", significance: "preview", summaries: { status: "pending" } }),
    );
    expect(releases).toContainEqual(
      expect.objectContaining({ version: "2.0.0-rc.0", significance: "preview", summaries: { status: "skipped" } }),
    );
  });

  it("does not touch a Correzione di rilevanza set by hand", async () => {
    db.prepare("update releases set significance_override = 'featured' where technology_id = ? and version = '1.1.0'").run(
      technology.id,
    );

    published.push(
      { version: "1.1.0", publishedAt: new Date("2026-02-01T00:00:00Z") },
      { version: "1.3.0", publishedAt: new Date("2026-05-01T00:00:00Z") },
    );
    await detectReleases(db, adapters);

    const corrected = (await readReleases(technology.id)).find((release) => release.version === "1.1.0");
    expect(corrected).toMatchObject({ significance: "notable", significance_override: "featured" });
  });

  it("does not download the list again when the Source says nothing changed", async () => {
    etag = '"v1"';
    published.push({ version: "1.4.0", publishedAt: new Date("2026-06-01T00:00:00Z") });
    await detectReleases(db, adapters);

    asked.length = 0;
    const report = await detectReleases(db, adapters);
    expect(report.unchanged).toBeGreaterThan(0);
    expect(asked.filter((call) => call.startsWith("notes"))).toEqual([]);
  });
});

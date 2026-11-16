import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { StoredTechnology } from "@/modules/catalog";
import { getTechnology } from "@/modules/catalog/server";
import type { SourceAdapters } from "@/modules/detection";
import { importTechnology, technologiesAwaitingImport } from "@/modules/detection/server";
import { seedTechnology, testDatabase } from "./database";

const now = new Date("2026-09-22T12:00:00Z");

// A fake npm and GitHub Releases pair, counting the calls so the test can see they are not repeated.
const calls: string[] = [];
const adapters: SourceAdapters = {
  async listVersions(source) {
    calls.push(`versions ${source.kind === "npm" ? source.package : source.repo}`);
    return {
      etag: null,
      versions: [
        { version: "8.0.0", publishedAt: new Date("2026-03-12T10:00:00Z") },
        { version: "8.3.0", publishedAt: new Date("2026-09-10T11:25:16Z") },
        { version: "8.3.1", publishedAt: new Date("2026-09-15T09:00:00Z") },
        { version: "8.4.0-beta.0", publishedAt: new Date("2026-09-18T09:00:00Z") },
        { version: "8.4.0-alpha.0", publishedAt: new Date("2026-09-17T09:00:00Z") },
        { version: "7.3.0", publishedAt: new Date("2025-12-01T09:00:00Z") },
        { version: "6.0.0", publishedAt: new Date("2024-11-26T09:00:00Z") },
      ],
    };
  },
  async findNotes(source, versions) {
    calls.push(`notes ${source.repo}`);
    const notes = new Map([
      ["8.0.0", "### Breaking Changes\n\n* **deps:** drop Node 18\r\n"],
      ["8.3.0", "### Features\n\n* **build:** faster preload"],
      ["7.3.0", "### Features\n\n* older minor"],
    ]);
    return new Map(
      versions.flatMap((version) => {
        const body = notes.get(version);
        return body ? [[version, { body, url: `https://github.com/${source.repo}/releases/tag/v${version}` }]] : [];
      }),
    );
  },
};

const ImportedSchema = z.array(
  z.object({
    version: z.string(),
    significance: z.string(),
    origin: z.string(),
    published_at: z.string(),
    body: z.string().nullable(),
    url: z.string().nullable(),
    source_id: z.uuid().nullable(),
    status: z.string().nullable(),
  }),
);

const db = testDatabase();
let technology: StoredTechnology;

function readImported() {
  const rows = db
    .prepare(
      `select r.version, r.significance, r.origin, r.published_at, n.body, n.url, n.source_id, s.status
       from releases r
       left join release_notes n on n.release_id = r.id
       left join summaries s on s.release_id = r.id
       where r.technology_id = ? order by r.version`,
    )
    .all(technology.id);
  return ImportedSchema.parse(rows).map(({ body, url, source_id, status, published_at, ...release }) => ({
    ...release,
    // Compared as instants, whatever precision the writer kept.
    published_at: new Date(published_at).toISOString(),
    release_notes: body === null ? null : { body, url, source_id },
    summaries: status === null ? null : { status },
  }));
}

beforeAll(async () => {
  const slug = `import-${randomUUID()}`;
  seedTechnology(db, {
    slug,
    name: "Import test",
    sources: [
      { role: "detection", kind: "npm", config: { package: slug } },
      { role: "notes", kind: "github-releases", config: { repo: `test/${slug}`, tagFormat: "v{version}" } },
    ],
  });
  const stored = await getTechnology(db, slug);
  if (!stored) throw new Error("seeded Technology not found");
  technology = stored;
});

describe("Initial Import", () => {
  it("waits for a Technology that has no Releases yet", async () => {
    const awaiting = await technologiesAwaitingImport(db);
    expect(awaiting.map((entry) => entry.id)).toContain(technology.id);
  });

  it("imports the last 12 months plus the latest featured Release, with notes as they are", async () => {
    await importTechnology(db, technology, adapters, now);

    const notesSource = technology.sources.find((source) => source.role === "notes");
    expect(readImported()).toEqual([
      {
        version: "7.3.0",
        significance: "notable",
        origin: "imported",
        published_at: "2025-12-01T09:00:00.000Z",
        release_notes: {
          body: "### Features\n\n* older minor",
          url: `https://github.com/test/${technology.slug}/releases/tag/v7.3.0`,
          source_id: notesSource?.id,
        },
        summaries: { status: "skipped" },
      },
      expect.objectContaining({ version: "8.0.0", significance: "featured", summaries: { status: "pending" } }),
      expect.objectContaining({ version: "8.3.0", significance: "notable", summaries: { status: "pending" } }),
      expect.objectContaining({ version: "8.3.1", significance: "digest", summaries: { status: "unavailable" } }),
      expect.objectContaining({
        version: "8.4.0-beta.0",
        significance: "preview",
        release_notes: null,
        summaries: { status: "unavailable" },
      }),
    ]);
    const featured = (readImported()).find((release) => release.version === "8.0.0");
    expect(featured?.release_notes?.body).toBe("### Breaking Changes\n\n* **deps:** drop Node 18\r\n");
  });

  it("no longer waits for the Technology once it has Releases", async () => {
    const awaiting = await technologiesAwaitingImport(db);
    expect(awaiting.map((entry) => entry.id)).not.toContain(technology.id);
  });

  it("creates no duplicates when run again", async () => {
    const before = readImported();
    await importTechnology(db, technology, adapters, now);
    expect(readImported()).toEqual(before);
  });
});

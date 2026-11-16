import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { StoredTechnology } from "@/modules/catalog";
import { getTechnology } from "@/modules/catalog/server";
import type { SourceAdapters } from "@/modules/detection";
import { backfillNotes } from "@/modules/detection/server";
import { sqliteJson } from "@/modules/db";
import { seedTechnology, testDatabase } from "./database";

// What the Source has learned to find since these Releases were imported. `2.0.1` is the Release the
// Source has nothing for: it stands for the `v7.0-rc` of TypeScript, a tag nobody ever published.
const available = new Map([
  ["2.0.0", "### Features\n\n* **api:** a late arrival"],
  ["3.0.0-rc.0", "### Breaking Changes\n\n* **node:** drop 20"],
]);

const asked: string[][] = [];
const adapters: SourceAdapters = {
  async listVersions() {
    throw new Error("the backfill must not ask for Versions");
  },
  async findNotes(source, versions) {
    asked.push([...versions].sort());
    return new Map(
      versions.flatMap((version) => {
        const body = available.get(version);
        return body ? [[version, { body, url: `https://github.com/${source.repo}/releases/tag/v${version}` }]] : [];
      }),
    );
  },
};

const StateSchema = z.array(
  z.object({
    version: z.string(),
    body: z.string().nullable(),
    source_id: z.uuid().nullable(),
    status: z.string().nullable(),
    content: sqliteJson(z.unknown()).nullable(),
  }),
);

const db = testDatabase();
let technology: StoredTechnology;
let bare: StoredTechnology;

function readState(technologyId: string) {
  const rows = db
    .prepare(
      `select r.version, n.body, n.source_id, s.status, s.content
       from releases r
       left join release_notes n on n.release_id = r.id
       left join summaries s on s.release_id = r.id
       where r.technology_id = ? order by r.version`,
    )
    .all(technologyId);
  return StateSchema.parse(rows).map((row) => ({
    version: row.version,
    release_notes: row.body === null ? null : { body: row.body, source_id: row.source_id },
    summaries: row.status === null ? null : { status: row.status, content: row.content },
  }));
}

async function seed(prefix: string, withNotesSource: boolean) {
  const slug = `${prefix}-${randomUUID()}`;
  seedTechnology(db, {
    slug,
    name: "Backfill test",
    sources: [
      { role: "detection", kind: "npm", config: { package: slug } },
      ...(withNotesSource
        ? [{ role: "notes" as const, kind: "github-releases", config: { repo: `test/${slug}`, tagFormat: "v{version}" } }]
        : []),
    ],
  });
  const stored = await getTechnology(db, slug);
  if (!stored) throw new Error("seeded Technology not found");
  return stored;
}

function seedRelease(
  technologyId: string,
  version: string,
  significance: string,
  summary: { status: string; content?: unknown; model?: string; promptVersion?: string },
  notes?: string,
) {
  const releaseId = randomUUID();
  db.prepare(
    "insert into releases (id, technology_id, version, significance, origin, published_at) values (?, ?, ?, ?, 'imported', '2026-02-01T09:00:00Z')",
  ).run(releaseId, technologyId, version, significance);
  db.prepare("insert into summaries (release_id, status, content, model, prompt_version) values (?, ?, ?, ?, ?)").run(
    releaseId,
    summary.status,
    summary.content === undefined ? null : JSON.stringify(summary.content),
    summary.model ?? null,
    summary.promptVersion ?? null,
  );
  if (notes !== undefined) db.prepare("insert into release_notes (release_id, body) values (?, ?)").run(releaseId, notes);
}

beforeAll(async () => {
  technology = await seed("backfill", true);
  bare = await seed("backfill-bare", false);
  // Already complete, and already summarized: the run must leave both alone.
  seedRelease(
    technology.id,
    "1.0.0",
    "featured",
    { status: "ready", content: { title: "A ready Summary" }, model: "claude-haiku-5-5", promptVersion: "v7" },
    "### Features\n\n* the notes it was born with",
  );
  seedRelease(technology.id, "2.0.0", "notable", { status: "unavailable" });
  seedRelease(technology.id, "2.0.1", "digest", { status: "unavailable" });
  seedRelease(technology.id, "3.0.0-rc.0", "preview", { status: "unavailable" });
  seedRelease(bare.id, "9.9.9", "notable", { status: "unavailable" });
});

describe("Ripresa delle Note di rilascio", () => {
  it("asks the Sources only for the Releases without notes, and writes nothing on a dry run", async () => {
    const before = await readState(technology.id);
    const report = await backfillNotes(db, adapters, { slug: technology.slug, apply: false });

    expect(asked).toEqual([["2.0.0", "2.0.1", "3.0.0-rc.0"]]);
    expect(report.applied).toBe(false);
    expect(report.missing).toBe(3);
    expect(report.filled.map(({ version }) => version)).toEqual(["2.0.0", "3.0.0-rc.0"]);
    expect(report.remaining).toEqual([{ slug: technology.slug, version: "2.0.1", reason: "not at the source" }]);
    expect(report.settled).toBe(0);
    expect(await readState(technology.id)).toEqual(before);
  });

  it("fills the missing notes and settles their Summary as skipped, never as pending", async () => {
    const report = await backfillNotes(db, adapters, { slug: technology.slug, apply: true });

    expect(report.applied).toBe(true);
    expect(report.settled).toBe(2);
    expect(report.failed).toEqual([]);
    const notesSource = technology.sources.find((source) => source.role === "notes");
    expect(await readState(technology.id)).toEqual([
      {
        version: "1.0.0",
        release_notes: { body: "### Features\n\n* the notes it was born with", source_id: null },
        summaries: { status: "ready", content: { title: "A ready Summary" } },
      },
      {
        version: "2.0.0",
        release_notes: { body: "### Features\n\n* **api:** a late arrival", source_id: notesSource?.id },
        summaries: { status: "skipped", content: null },
      },
      { version: "2.0.1", release_notes: null, summaries: { status: "unavailable", content: null } },
      {
        version: "3.0.0-rc.0",
        release_notes: { body: "### Breaking Changes\n\n* **node:** drop 20", source_id: notesSource?.id },
        summaries: { status: "skipped", content: null },
      },
    ]);
  });

  it("asks only for what is still missing when it runs again", async () => {
    asked.length = 0;
    const report = await backfillNotes(db, adapters, { slug: technology.slug, apply: true });

    expect(asked).toEqual([["2.0.1"]]);
    expect(report.missing).toBe(1);
    expect(report.filled).toEqual([]);
    expect(report.settled).toBe(0);
  });

  it("says why a Technology without a notes Source is left as it is, without asking anybody", async () => {
    asked.length = 0;
    const report = await backfillNotes(db, adapters, { slug: bare.slug, apply: true });

    expect(asked).toEqual([]);
    expect(report.asked).toBe(0);
    expect(report.remaining).toEqual([{ slug: bare.slug, version: "9.9.9", reason: "no notes source" }]);
  });
});

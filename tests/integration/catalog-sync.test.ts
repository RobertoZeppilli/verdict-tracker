import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { CatalogEntry } from "@/modules/catalog";
import { syncCatalog } from "@/modules/catalog/server";
import { testDatabase } from "./database";

const slug = `sync-${randomUUID()}`;
const entry: CatalogEntry = {
  slug,
  name: "Sync test",
  description: "A Technology written by the Catalog sync",
  category: "library",
  classificationStrategy: "semver",
  sources: [
    { role: "detection", kind: "npm", package: slug },
    { role: "notes", kind: "github-releases", repo: `test/${slug}`, tagFormat: "v{version}" },
  ],
};

const TechnologySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  retired: z.number().transform((retired) => retired === 1),
  updated_at: z.string(),
});

const db = testDatabase();

function readTechnology() {
  const technology = TechnologySchema.parse(
    db.prepare("select id, name, retired, updated_at from technologies where slug = ?").get(slug),
  );
  const sources = db.prepare("select id, kind, config from sources where technology_id = ? order by kind").all(technology.id);
  return { ...technology, sources };
}

function sync(entries: CatalogEntry[]) {
  return syncCatalog(db, entries);
}

describe("Catalog sync", () => {
  it("writes a new Technology with its Sources", async () => {
    const operations = await sync([entry]);
    expect(operations).toContainEqual({ type: "insert", entry });

    const technology = readTechnology();
    expect(technology.retired).toBe(false);
    expect(technology.sources.map((source) => source.kind).sort()).toEqual(["github-releases", "npm"]);
  });

  it("changes nothing when run again", async () => {
    const before = readTechnology();
    expect(await sync([entry])).toEqual([]);
    expect(readTechnology()).toEqual(before);
  });

  it("deletes a removed Source but keeps the Release Notes it provided", async () => {
    const technology = readTechnology();
    const notesSource = technology.sources.find((source) => source.kind === "github-releases");
    const releaseId = randomUUID();
    db.prepare(
      "insert into releases (id, technology_id, version, significance, origin, published_at) values (?, ?, '1.0.0', 'featured', 'detected', ?)",
    ).run(releaseId, technology.id, new Date().toISOString());
    db.prepare("insert into release_notes (release_id, source_id, body) values (?, ?, '## Changes')").run(
      releaseId,
      z.object({ id: z.string() }).parse(notesSource).id,
    );

    await sync([{ ...entry, sources: entry.sources.slice(0, 1) }]);

    expect((readTechnology()).sources.map((source) => source.kind)).toEqual(["npm"]);
    const kept = db.prepare("select source_id, body from release_notes where release_id = ?").get(releaseId);
    expect({ ...kept }).toEqual({ source_id: null, body: "## Changes" });
  });

  it("retires a Technology whose file is gone, without deleting it", async () => {
    await sync([]);
    expect((readTechnology()).retired).toBe(true);
  });

  it("brings the Technology back when its file returns", async () => {
    await sync([entry]);
    const technology = readTechnology();
    expect(technology.retired).toBe(false);
    expect(technology.sources).toHaveLength(2);
  });
});

import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/modules/db/server";
import {
  alignFollows,
  readFollows,
  readVault,
  saveFollows,
  saveVault,
  writeCurrentVersion,
  writeFollows,
} from "@/modules/follows/server";
import { retire, seedTechnology, testDatabase } from "./database";

// `verdict.json` is the authority and the database a cache (issue #217): what follows proves it by
// throwing the database away, not by promising it.
let directory: string;
let file: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "verdict-state-"));
  file = join(directory, "verdict.json");
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

// The same Catalog in every database, as `catalog:sync` writes it: same slugs, new ids each time.
function catalogDatabase(): { db: Database; ids: Record<string, string> } {
  const db = testDatabase();
  const ids: Record<string, string> = {};
  for (const slug of ["next", "vite", "zod"]) {
    ids[slug] = seedTechnology(db, { slug, name: slug });
    db.prepare(
      `insert into releases (id, technology_id, version, significance, origin, published_at)
       values (?, ?, '2.0.0', 'notable', 'detected', ?)`,
    ).run(randomUUID(), ids[slug], new Date().toISOString());
  }
  return { db, ids };
}

async function bySlug(db: Database, ids: Record<string, string>) {
  const slugs = new Map(Object.entries(ids).map(([slug, id]) => [id, slug]));
  return Object.fromEntries((await readFollows(db)).map((f) => [slugs.get(f.technologyId), f.currentVersion]));
}

function written(): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("the follows file", () => {
  it("keeps the vault when a follow rewrites it (issue #244)", () => {
    const { db, ids } = catalogDatabase();
    expect(saveVault(file, "C:/notes")).toEqual({ ok: true });
    writeFollows(db, [ids.vite!], true);
    saveFollows(db, file);
    expect(readVault(file)).toBe("C:/notes");
    expect(saveVault(file, null)).toEqual({ ok: true });
    expect(written()).toEqual({ follows: { vite: {} } });
  });

  it("brings back every follow and Version in use when the database is thrown away", async () => {
    const before = catalogDatabase();
    writeFollows(before.db, [before.ids.next!, before.ids.vite!], true);
    expect(await writeCurrentVersion(before.db, before.ids.next!, "2.0.0")).toMatchObject({ ok: true });
    saveFollows(before.db, file);
    const expected = await bySlug(before.db, before.ids);
    before.db.close();

    const after = catalogDatabase();
    expect(await alignFollows(after.db, file)).toEqual([]);
    expect(await bySlug(after.db, after.ids)).toEqual(expected);
  });

  it("follows a slug written in by hand", async () => {
    const { db, ids } = catalogDatabase();
    writeFileSync(file, '{ "follows": { "zod": { "currentVersion": "v2.0.0" } } }');
    expect(await alignFollows(db, file)).toEqual([]);
    expect(await bySlug(db, ids)).toEqual({ zod: { version: "2.0.0", declaredAt: expect.any(Date) } });
  });

  it("lets go of what the file no longer lists", async () => {
    const { db, ids } = catalogDatabase();
    writeFollows(db, [ids.next!, ids.vite!], true);
    writeFileSync(file, '{ "follows": { "vite": {} } }');
    await alignFollows(db, file);
    expect(await bySlug(db, ids)).toEqual({ vite: null });
  });

  it("reports a slug outside the Catalog, applies the rest and keeps it in the file", async () => {
    const { db, ids } = catalogDatabase();
    writeFileSync(file, '{ "follows": { "nope": {}, "vite": {} } }');
    expect(await alignFollows(db, file)).toEqual(["nope is not in the Catalog"]);
    expect(await bySlug(db, ids)).toEqual({ vite: null });

    writeFollows(db, [ids.zod!], true);
    saveFollows(db, file);
    expect(written()).toEqual({ follows: { nope: {}, vite: {}, zod: {} } });
  });

  it("reports a retired Technology or a refused Version in use without stopping", async () => {
    const { db, ids } = catalogDatabase();
    retire(db, ids.zod!);
    writeFileSync(file, '{ "follows": { "zod": {}, "next": { "currentVersion": "9.0.0" } } }');
    const warnings = await alignFollows(db, file);
    expect(warnings).toHaveLength(2);
    expect(await bySlug(db, ids)).toEqual({ next: null });
  });

  // GLOSSARY.md: a retired Technology already followed stays followed. The trigger fires before
  // `on conflict`, so the insert must not even be tried for a row that is there.
  it("keeps a retired Technology already followed, and aligns its Version in use", async () => {
    const { db, ids } = catalogDatabase();
    writeFollows(db, [ids.zod!], true);
    retire(db, ids.zod!);
    writeFileSync(file, '{ "follows": { "zod": { "currentVersion": "2.0.0" } } }');
    expect(await alignFollows(db, file)).toEqual([]);
    expect(await bySlug(db, ids)).toEqual({ zod: { version: "2.0.0", declaredAt: expect.any(Date) } });
  });

  it("is written from the database the first time, when it does not exist", async () => {
    const { db, ids } = catalogDatabase();
    writeFollows(db, [ids.vite!], true);
    expect(await alignFollows(db, file)).toEqual([]);
    expect(written()).toEqual({ follows: { vite: {} } });
  });

  it("is never overwritten when it does not parse, and leaves the database alone", async () => {
    const { db, ids } = catalogDatabase();
    writeFollows(db, [ids.vite!], true);
    writeFileSync(file, "{ broken");
    expect(await alignFollows(db, file)).toHaveLength(1);
    saveFollows(db, file);
    expect(readFileSync(file, "utf8")).toBe("{ broken");
    expect(await bySlug(db, ids)).toEqual({ vite: null });
  });
});

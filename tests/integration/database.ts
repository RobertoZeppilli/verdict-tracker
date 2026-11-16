import { randomUUID } from "node:crypto";
import { type Database, openDatabase } from "@/modules/db/server";

// A data file of its own for every test file, in memory, with the real migrations: what a fresh
// install opens (issue #211). No service to start, and nothing one file leaves behind reaches the
// next, which is what `clearFollows` and the deletes after each file were for until then.
export function testDatabase(): Database {
  return openDatabase({ file: ":memory:" });
}

export type Content = { technologyId: string; releaseId: string };

// A Technology with one Release, its notes and a Summary.
export function seedContent(db: Database): Content {
  const [technologyId] = seedCatalog(db, 1);
  const releaseId = randomUUID();
  db.prepare(
    `insert into releases (id, technology_id, version, significance, origin, published_at)
     values (?, ?, '1.0.0', 'featured', 'detected', ?)`,
  ).run(releaseId, technologyId, new Date().toISOString());
  db.prepare("insert into release_notes (release_id, body) values (?, '## Changes')").run(releaseId);
  db.prepare("insert into summaries (release_id, status) values (?, 'pending')").run(releaseId);
  return { technologyId, releaseId };
}

// Bare Technologies, as many as a test asks for: no Releases, no Sources, no Summaries.
export function seedCatalog(db: Database, count: number): string[] {
  const insert = db.prepare(
    `insert into technologies (id, slug, name, category, classification_strategy)
     values (?, ?, ?, 'library', 'semver')`,
  );
  return Array.from({ length: count }, () => {
    const id = randomUUID();
    const slug = `tech-${id}`;
    insert.run(id, slug, slug);
    return id;
  });
}

export function retire(db: Database, technologyId: string): void {
  db.prepare("update technologies set retired = 1 where id = ?").run(technologyId);
}

export function clearFollows(db: Database): void {
  db.exec("delete from follows");
}

type SourceRow = { role: "detection" | "notes"; kind: string; config: Record<string, unknown> };

// A Technology with the Sources a test hands it, for the jobs that read them.
export function seedTechnology(
  db: Database,
  { slug, name, retired = false, sources = [] }: { slug: string; name: string; retired?: boolean; sources?: SourceRow[] },
): string {
  const id = randomUUID();
  db.prepare(
    `insert into technologies (id, slug, name, category, classification_strategy, retired)
     values (?, ?, ?, 'library', 'semver', ?)`,
  ).run(id, slug, name, retired ? 1 : 0);
  const source = db.prepare("insert into sources (technology_id, role, kind, config) values (?, ?, ?, ?)");
  for (const { role, kind, config } of sources) source.run(id, role, kind, JSON.stringify(config));
  return id;
}

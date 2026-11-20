import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { Database } from "@/modules/db/server";
import { upgradeStartRejection } from "@/modules/releases";
import { listReleases } from "@/modules/releases/server";
import {
  mergeStateFile,
  type ParsedStateFile,
  parseStateFile,
  type StateEntry,
  type StateFile,
  serializeStateFile,
} from "../domain/state-file";
import { typedVersion } from "./follows";

const TechnologyRowSchema = z.object({ id: z.string(), slug: z.string() });
const FollowRowSchema = z.object({
  slug: z.string(),
  current_version: z.string().nullable(),
  current_version_declared_at: z.string().nullable(),
});

type Read = ParsedStateFile | { ok: false; missing: true };

function readStateFile(file: string): Read {
  if (!existsSync(file)) return { ok: false, missing: true };
  return parseStateFile(readFileSync(file, "utf8"));
}

// At startup (issue #217): the file is the authority, so the table is brought to what it says.
// Returns what could not be applied, for the caller to print; none of it stops the app.
export async function alignFollows(db: Database, file: string): Promise<string[]> {
  const read = readStateFile(file);
  // The first start with this file: what the table held until now becomes the file.
  if ("missing" in read) {
    saveFollows(db, file);
    return [];
  }
  if (!read.ok) return [`${file} is not valid, the follows stay as they were: ${read.reason}`];

  const ids = new Map(
    z
      .array(TechnologyRowSchema)
      .parse(db.prepare("select id, slug from technologies").all())
      .map((row) => [row.slug, row.id]),
  );
  const warnings: string[] = [];
  const wanted = new Map<string, { slug: string; version: string | null; declaredAt: string | null }>();
  for (const [slug, entry] of Object.entries(read.state.follows)) {
    const id = ids.get(slug);
    if (id === undefined) {
      warnings.push(`${slug} is not in the Catalog`);
      continue;
    }
    wanted.set(id, { slug, ...(await declared(db, id, slug, entry, warnings)) });
  }

  const unfollow = db.prepare("delete from follows where technology_id = ?");
  const follow = db.prepare("insert into follows (technology_id) values (?)");
  // A declaredAt from the file wins; without one, the same Version keeps its day and a new one starts today.
  const declare = db.prepare(
    `update follows set
       current_version_declared_at = case
         when ?1 is null then null
         when ?2 is not null then ?2
         when current_version is ?1 then current_version_declared_at
         else strftime('%Y-%m-%dT%H:%M:%fZ', 'now') end,
       current_version = ?1
     where technology_id = ?3`,
  );
  db.exec("begin");
  try {
    const existing = new Set(db.prepare("select technology_id from follows").all().map((row) => String(row.technology_id)));
    for (const id of existing) if (!wanted.has(id)) unfollow.run(id);
    for (const [id, { slug, version, declaredAt }] of wanted) {
      // Only what is not followed yet: the retired trigger fires before `on conflict` would, so a
      // retired Technology already followed must not be inserted again (GLOSSARY.md, Seguire).
      if (!existing.has(id)) {
        try {
          follow.run(id);
        } catch {
          // The only refusal is the retired trigger, and it aborts this statement, not the transaction.
          warnings.push(`${slug} is retired and cannot be followed again`);
          continue;
        }
      }
      declare.run(version, declaredAt, id);
    }
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
  return warnings;
}

// The same rule as `writeCurrentVersion`: a Version in use that the interface would refuse is
// reported and left out, and the follow stands without it.
async function declared(
  db: Database,
  id: string,
  slug: string,
  entry: StateEntry,
  warnings: string[],
): Promise<{ version: string | null; declaredAt: string | null }> {
  if (entry.currentVersion === undefined) return { version: null, declaredAt: null };
  const version = typedVersion(entry.currentVersion);
  const rejection = upgradeStartRejection(await listReleases(db, id), version);
  if (rejection === null) return { version, declaredAt: entry.declaredAt ?? null };
  warnings.push(`${slug}: the Version in use ${entry.currentVersion} is refused (${rejection})`);
  return { version: null, declaredAt: null };
}

// After every change from the interface. A file that does not parse is left alone: it holds hand
// edits that overwriting would lose, and the change stays in the database until the file is fixed.
export function saveFollows(db: Database, file: string): void {
  const read = readStateFile(file);
  if (!read.ok && !("missing" in read)) {
    console.warn(`${file} is not valid and was not rewritten: ${read.reason}`);
    return;
  }
  const rows = z
    .array(FollowRowSchema)
    .parse(
      db
        .prepare(
          `select t.slug, f.current_version, f.current_version_declared_at
           from follows f join technologies t on t.id = f.technology_id`,
        )
        .all(),
    );
  const followed = Object.fromEntries(
    rows.map((row) => [
      row.slug,
      row.current_version === null || row.current_version_declared_at === null
        ? {}
        : { currentVersion: row.current_version, declaredAt: row.current_version_declared_at },
    ]),
  );
  const known = new Set(db.prepare("select slug from technologies").all().map((row) => String(row.slug)));
  writeStateFile(file, mergeStateFile(read.ok ? read.state : { follows: {} }, followed, known));
}

// The vault of `/settings` (issue #244), or undefined when none was saved or the file does not parse.
export function readVault(file: string): string | undefined {
  const read = readStateFile(file);
  return read.ok ? read.state.vault : undefined;
}

// Null removes it. A file that does not parse is refused rather than rewritten, as in `saveFollows`.
export function saveVault(file: string, vault: string | null): { ok: true } | { ok: false; reason: string } {
  const read = readStateFile(file);
  if (!read.ok && !("missing" in read)) return { ok: false, reason: `${file} is not valid: ${read.reason}` };
  // `undefined` is left out by `JSON.stringify`, so null drops the key.
  writeStateFile(file, { ...(read.ok ? read.state : { follows: {} }), vault: vault ?? undefined });
  return { ok: true };
}

// Written aside and renamed over, so a sync client or a crash never sees half a file.
function writeStateFile(file: string, state: StateFile): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, serializeStateFile(state));
  renameSync(`${file}.tmp`, file);
}

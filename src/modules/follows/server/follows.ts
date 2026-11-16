import { z } from "zod";
import type { Database } from "@/modules/db/server";
import { listReleases } from "@/modules/releases/server";
import { upgradeStartRejection } from "@/modules/releases";
import type { CurrentVersion, Decline, Follow } from "../domain/current-version";
import { type FollowRejection, followRejectionFor } from "../domain/follow-rejection";

const FollowRowSchema = z.object({
  technology_id: z.uuid(),
  current_version: z.string().nullable(),
  current_version_declared_at: z.iso.datetime({ offset: true }).nullable(),
});

// The query names nobody because there is nobody to name: an installed copy belongs to one person,
// so the table holds their follows and no others (issue #210, ADR 0011).
export async function readFollows(db: Database): Promise<Follow[]> {
  return z
    .array(FollowRowSchema)
    .parse(db.prepare("select technology_id, current_version, current_version_declared_at from follows").all())
    .map((row) => ({ technologyId: row.technology_id, currentVersion: declarationOf(row) }));
}

// The two columns travel together (a check constraint says so), so one being set is enough.
function declarationOf(row: Omit<z.infer<typeof FollowRowSchema>, "technology_id">): CurrentVersion | null {
  return row.current_version && row.current_version_declared_at
    ? { version: row.current_version, declaredAt: new Date(row.current_version_declared_at) }
    : null;
}

// One transaction for a group, which is what makes a refusal a fact about the group (issue #126):
// the trigger runs for each row, one retired Technology raises, and nothing is followed halfway.
// Following what is already followed is not a refusal: the group may hold rows the page had.
export function writeFollows(db: Database, technologyIds: readonly string[], follow: boolean): FollowRejection | null {
  const statement = follow
    ? // Not `on conflict do nothing`: the retired trigger fires before it, and would refuse a retired
      // Technology still followed. A row already there inserts nothing, so the trigger never runs.
      db.prepare(
        "insert into follows (technology_id) select ?1 where not exists (select 1 from follows where technology_id = ?1)",
      )
    : db.prepare("delete from follows where technology_id = ?");
  db.exec("begin");
  try {
    for (const technologyId of technologyIds) statement.run(technologyId);
    db.exec("commit");
    return null;
  } catch (error) {
    db.exec("rollback");
    // The triggers raise `FRTRD: …`: the code is the start of the message, as the SQLSTATE was.
    return followRejectionFor(error instanceof Error ? error.message.slice(0, 5) : undefined);
  }
}

// Written the way the Upgrade Path reads it: trimmed, and without the `v` it accepts.
export function typedVersion(version: string): string {
  return version.trim().replace(/^v(?=\d)/, "");
}

export type Declared = { ok: true; currentVersion: CurrentVersion | null } | { ok: false; decline: Decline };

// The rule `enforce_current_version` held in Postgres (issue #68), here because SQLite triggers
// cannot compare Versions: the Version in use is validated exactly as the start of an Upgrade Path
// (GLOSSARY.md), and re-declaring the same Version keeps the day it was first declared.
export async function writeCurrentVersion(
  db: Database,
  technologyId: string,
  version: string | null,
): Promise<Declared> {
  const typed = version === null ? null : typedVersion(version);
  if (typed !== null) {
    const rejection = upgradeStartRejection(await listReleases(db, technologyId), typed);
    if (rejection) return { ok: false, decline: rejection };
  }
  try {
    const row = db
      .prepare(
        `update follows set
           current_version_declared_at = case
             when ?1 is null then null
             when current_version is ?1 then current_version_declared_at
             else strftime('%Y-%m-%dT%H:%M:%fZ', 'now') end,
           current_version = ?1
         where technology_id = ?2
         returning current_version, current_version_declared_at`,
      )
      .get(typed, technologyId);
    // No row is a Technology that is not followed: there is no follow to declare on.
    if (row === undefined) return { ok: false, decline: "denied" };
    return { ok: true, currentVersion: declarationOf(FollowRowSchema.omit({ technology_id: true }).parse(row)) };
  } catch {
    // The shape check of the table is looser than the rule above, so nothing valid reaches here.
    return { ok: false, decline: "denied" };
  }
}

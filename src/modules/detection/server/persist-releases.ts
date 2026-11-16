import { z } from "zod";
import type { StoredTechnology } from "@/modules/catalog";
import type { Database } from "@/modules/db/server";
import { initialSummaryStatus, type Significance } from "@/modules/releases";
import type { SourceAdapters } from "../domain/source-adapters";
import { findNotes } from "./find-notes";

const ReleaseIdSchema = z.object({ id: z.uuid() });

export type ReleaseOrigin = "imported" | "detected";

// `skip` says the phase chose not to summarize this Release; the notes decide the rest.
export type ReleaseToStore = { version: string; significance: Significance; publishedAt: Date; skip: boolean };

// Writes the Releases, their Release Notes and the initial state of their Summaries.
//
// Idempotent on Technology + Version: `on conflict do nothing` leaves an existing Release, its
// notes and its Summary alone, so a Correzione di rilevanza set by hand survives every later run — the
// Detection never updates `significance`, let alone `significance_override`.
export async function persistReleases(
  db: Database,
  technology: StoredTechnology,
  adapters: SourceAdapters,
  origin: ReleaseOrigin,
  releases: readonly ReleaseToStore[],
): Promise<string[]> {
  if (releases.length === 0) return [];
  const versions = releases.map((release) => release.version);
  const notes = await findNotes(technology, adapters, versions);

  const insertRelease = db.prepare(
    `insert into releases (technology_id, version, significance, origin, published_at) values (?, ?, ?, ?, ?)
     on conflict (technology_id, version) do nothing`,
  );
  const releaseId = db.prepare("select id from releases where technology_id = ? and version = ?");
  const insertNotes = db.prepare(
    "insert into release_notes (release_id, source_id, body, url) values (?, ?, ?, ?) on conflict (release_id) do nothing",
  );
  const insertSummary = db.prepare(
    "insert into summaries (release_id, status) values (?, ?) on conflict (release_id) do nothing",
  );

  // One transaction for the run: a run that stops halfway leaves no Release without its Summary row.
  db.exec("begin");
  try {
    for (const release of releases) {
      insertRelease.run(technology.id, release.version, release.significance, origin, release.publishedAt.toISOString());
      const { id } = ReleaseIdSchema.parse(releaseId.get(technology.id, release.version));
      const found = notes.get(release.version);
      if (found) insertNotes.run(id, found.sourceId, found.body, found.url);
      insertSummary.run(
        id,
        initialSummaryStatus({ significance: release.significance, hasNotes: found !== undefined, skip: release.skip }),
      );
    }
    db.exec("commit");
  } catch (error) {
    db.exec("rollback");
    throw error;
  }
  return releases.map((release) => release.version);
}

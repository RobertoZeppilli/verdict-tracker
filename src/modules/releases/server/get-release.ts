import { z } from "zod";
import { sqliteJson } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { judge, notesHead, type StoredSummary, SummaryContentSchema } from "@/modules/summaries";
import { SummaryStatusSchema } from "../domain/initial-summary-status";
import type { ReleaseDetail } from "../domain/release-page";
import { SignificanceSchema } from "../domain/significance";

// release_notes and summaries share the Release's primary key, so each joins as one row or none.
const ReleaseDetailRowSchema = z.object({
  version: z.string(),
  significance: SignificanceSchema,
  significance_override: SignificanceSchema.nullable(),
  origin: z.enum(["imported", "detected"]),
  published_at: z.iso.datetime({ offset: true }),
  created_at: z.iso.datetime({ offset: true }),
  notes_body: z.string().nullable(),
  notes_url: z.string().nullable(),
  summary_status: SummaryStatusSchema.nullable(),
  // Parsed as JSON here and against the Summary schema in `readSummary`.
  summary_content: sqliteJson(z.unknown()).nullable(),
  model: z.string().nullable(),
  prompt_version: z.string().nullable(),
});

type ReleaseDetailRow = z.infer<typeof ReleaseDetailRowSchema>;

export async function getRelease(db: Database, technologyId: string, version: string): Promise<ReleaseDetail | null> {
  const data = db
    .prepare(
      `select r.version, r.significance, r.significance_override, r.origin, r.published_at, r.created_at,
         n.body as notes_body, n.url as notes_url, s.status as summary_status, s.content as summary_content,
         s.model, s.prompt_version
       from releases r
       left join release_notes n on n.release_id = r.id
       left join summaries s on s.release_id = r.id
       where r.technology_id = ? and r.version = ?`,
    )
    .get(technologyId, version);
  if (data === undefined) return null;
  const row = ReleaseDetailRowSchema.parse(data);
  const summary = readSummary(row);
  // The page already carries the whole body, so the head comes from it instead of a second column.
  const notes = row.notes_body === null ? null : notesHead(row.notes_body);
  return {
    version: row.version,
    significance: row.significance_override ?? row.significance,
    origin: row.origin,
    publishedAt: new Date(row.published_at),
    recordedAt: new Date(row.created_at),
    notes: row.notes_body === null ? null : { body: row.notes_body, url: row.notes_url },
    summaryStatus: row.summary_status,
    summary,
    unjudged: summary !== null && judge(summary.content, notes).unjudged,
  };
}

// Stored content is checked again on read: a row that does not validate shows as unavailable. The
// provenance is read the same way instead of being trusted: the constraint of issue #88 keeps a ready
// row from losing it, and a row that somehow did is not a Summary we are willing to show.
function readSummary(row: ReleaseDetailRow): StoredSummary | null {
  if (row.summary_status !== "ready") return null;
  const { model, prompt_version: promptVersion } = row;
  if (model === null || promptVersion === null) return null;
  const content = SummaryContentSchema.safeParse(row.summary_content);
  return content.success ? { content: content.data, model, promptVersion } : null;
}

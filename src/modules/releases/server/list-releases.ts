import { z } from "zod";
import { sqliteJson } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { judge, type NotesHead, storedNotesHead, type SummaryContent, SummaryContentSchema } from "@/modules/summaries";
import { SummaryStatusSchema } from "../domain/initial-summary-status";
import { SignificanceSchema } from "../domain/significance";
import type { SummarizedRelease } from "../domain/upgrade-path";

const ReleaseRowSchema = z.object({
  version: z.string(),
  significance: SignificanceSchema,
  significance_override: SignificanceSchema.nullable(),
  published_at: z.iso.datetime({ offset: true }),
  summary_status: SummaryStatusSchema.nullable(),
  summary_content: sqliteJson(z.unknown()).nullable(),
  // Only the head of the notes: enough to judge them, and bounded whatever the Release carries.
  body_head: z.string().nullable(),
});

// A Significance Override always wins over the Classification Strategy.
export async function listReleases(db: Database, technologyId: string): Promise<SummarizedRelease[]> {
  const data = db
    .prepare(
      `select r.version, r.significance, r.significance_override, r.published_at, s.status as summary_status,
         s.content as summary_content, n.body_head
       from releases r
       left join summaries s on s.release_id = r.id
       left join release_notes n on n.release_id = r.id
       where r.technology_id = ?
       order by r.published_at`,
    )
    .all(technologyId);
  return z
    .array(ReleaseRowSchema)
    .parse(data)
    .map((row) => ({
      version: row.version,
      significance: row.significance_override ?? row.significance,
      publishedAt: new Date(row.published_at),
      summaryStatus: row.summary_status,
      ...readSummary(row.summary_status, row.summary_content, storedNotesHead(row.body_head)),
    }));
}

// Content that does not match the schema counts as no Summary: never as safe to upgrade.
function readSummary(
  status: string | null,
  content: unknown,
  notes: NotesHead | null,
): { actionRequired: boolean | null; unjudged: boolean; summary: SummaryContent | null } {
  if (status !== "ready") return { actionRequired: null, unjudged: false, summary: null };
  const parsed = SummaryContentSchema.safeParse(content);
  if (!parsed.success) return { actionRequired: null, unjudged: false, summary: null };
  return { ...judge(parsed.data, notes), summary: parsed.data };
}

import { z } from "zod";
import type { DashboardRelease, FollowedTechnology } from "../domain/followed";
import { sqliteJson } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { SignificanceSchema, SummaryStatusSchema } from "@/modules/releases";
import { judge, storedNotesHead, SummaryContentSchema } from "@/modules/summaries";

const FollowRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  current_version: z.string().nullable(),
  current_version_declared_at: z.iso.datetime({ offset: true }).nullable(),
});

const ReleaseRowSchema = z.object({
  slug: z.string(),
  version: z.string(),
  significance: SignificanceSchema,
  significance_override: SignificanceSchema.nullable(),
  published_at: z.iso.datetime({ offset: true }),
  summary_status: SummaryStatusSchema.nullable(),
  summary_content: sqliteJson(z.unknown()).nullable(),
  // Only the head of the notes: enough to judge them, and bounded whatever the Release carries.
  body_head: z.string().nullable(),
});

export type DashboardData = { followed: FollowedTechnology[]; releases: DashboardRelease[] };

// The queries name nobody because there is nobody to name (issue #210, ADR 0011). Every Release of
// a followed Technology comes back, not just the window: the compact row needs the latest major
// however old, and the Weekly Digest needs them all.
export async function readDashboard(db: Database): Promise<DashboardData> {
  const follows = z.array(FollowRowSchema).parse(
    db
      .prepare(
        `select t.slug, t.name, f.current_version, f.current_version_declared_at
         from follows f join technologies t on t.id = f.technology_id`,
      )
      .all(),
  );
  const releases = z.array(ReleaseRowSchema).parse(
    db
      .prepare(
        `select t.slug, r.version, r.significance, r.significance_override, r.published_at,
           s.status as summary_status, s.content as summary_content, n.body_head
         from follows f
         join technologies t on t.id = f.technology_id
         join releases r on r.technology_id = f.technology_id
         left join summaries s on s.release_id = r.id
         left join release_notes n on n.release_id = r.id`,
      )
      .all(),
  );
  return {
    followed: follows.map((row) => ({
      slug: row.slug,
      name: row.name,
      // The database keeps the two columns together, so one being set is enough to read the pair.
      currentVersion:
        row.current_version && row.current_version_declared_at
          ? { version: row.current_version, declaredAt: new Date(row.current_version_declared_at) }
          : null,
    })),
    releases: releases.map(toDashboardRelease),
  };
}

// A Significance Override always wins over the Classification Strategy, as on the Technology page.
// Content that does not match the schema counts as no Summary: never as safe to upgrade.
function toDashboardRelease(row: z.infer<typeof ReleaseRowSchema>): DashboardRelease {
  const ready = row.summary_status === "ready" ? SummaryContentSchema.safeParse(row.summary_content) : null;
  const summary = ready?.success ? ready.data : null;
  return {
    slug: row.slug,
    version: row.version,
    significance: row.significance_override ?? row.significance,
    publishedAt: new Date(row.published_at),
    summaryStatus: row.summary_status,
    summary,
    ...judge(summary, storedNotesHead(row.body_head)),
  };
}

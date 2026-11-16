import { z } from "zod";
import type { Database } from "@/modules/db/server";
import { type SitemapPage, sitemapPages } from "../domain/sitemap";

const TechnologyRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  updated_at: z.iso.datetime({ offset: true }),
});

const ReleaseRowSchema = z.object({
  technology_id: z.uuid(),
  version: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  summary_updated_at: z.iso.datetime({ offset: true }).nullable(),
});

// Retired Technologies are not filtered out: their pages stay reachable. The order of the pages is
// the domain's job.
export async function listSitemapPages(db: Database): Promise<SitemapPage[]> {
  const technologies = db.prepare("select id, slug, updated_at from technologies order by slug").all();
  const releases = db
    .prepare(
      `select r.technology_id, r.version, r.created_at, s.updated_at as summary_updated_at
       from releases r left join summaries s on s.release_id = r.id`,
    )
    .all();
  return sitemapPages(
    z.array(TechnologyRowSchema).parse(technologies).map((row) => ({
      id: row.id,
      slug: row.slug,
      lastModified: new Date(row.updated_at),
    })),
    // A Release page changes when the Release is recorded and again when its Summary settles,
    // and the later of the two is the day the page last said something new.
    z.array(ReleaseRowSchema).parse(releases).map((row) => ({
      technologyId: row.technology_id,
      version: row.version,
      lastModified: latest(row.created_at, row.summary_updated_at),
    })),
  );
}

function latest(recorded: string, settled: string | null): Date {
  const dates = [new Date(recorded), ...(settled ? [new Date(settled)] : [])];
  return dates.reduce((a, b) => (a > b ? a : b));
}

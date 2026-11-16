import { z } from "zod";
import type { Database } from "@/modules/db/server";

const TechnologyRowSchema = z.object({ id: z.uuid(), slug: z.string() });
const ReleaseRowSchema = z.object({ technology_id: z.uuid(), version: z.string() });

// Every public page that has a parameter in its address, which is what the showcase build has to
// enumerate: `output: "export"` renders what `generateStaticParams` names and nothing else, so a
// Release missing from here is a Release with no page (issue #215).
export type StaticPages = {
  technologies: { slug: string }[];
  releases: { slug: string; version: string }[];
};

// Retired Technologies are in, as they are in the sitemap: their pages stay reachable.
async function load(db: Database): Promise<StaticPages> {
  const technologies = db.prepare("select id, slug from technologies order by slug").all();
  const releases = db.prepare("select technology_id, version from releases").all();
  const slugs = new Map(
    z.array(TechnologyRowSchema).parse(technologies).map((row) => [row.id, row.slug]),
  );
  return {
    technologies: [...slugs.values()].map((slug) => ({ slug })),
    releases: z
      .array(ReleaseRowSchema)
      .parse(releases)
      .flatMap((row) => {
        const slug = slugs.get(row.technology_id);
        // A Release whose Technology was deleted has no address to be exported at.
        return slug ? [{ slug, version: row.version }] : [];
      }),
  };
}

let pending: Promise<StaticPages> | null = null;

// ⚠️ Memoised for the life of the process, which is a build and only a build: `generateStaticParams`
// runs once per route **per language**, so the two public routes would otherwise read the whole
// `releases` table four times to learn the same two thousand addresses. Nothing here is ever reached
// by a request: in the app with the server both routes return no parameters at all.
export function listStaticPages(db: Database): Promise<StaticPages> {
  pending ??= load(db);
  return pending;
}

import { z } from "zod";
import { CategorySchema } from "@/modules/catalog";
import { sqliteBoolean, sqliteJson } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { latestStableRelease } from "@/modules/releases";
import type { PickerTechnology } from "../domain/picker";

const PickerRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  retired: sqliteBoolean,
  category: CategorySchema,
  releases: sqliteJson(z.array(z.object({ version: z.string(), published_at: z.iso.datetime({ offset: true }) }))),
});

// One query for the whole picker: Versions are short strings, so a per Technology query would cost
// far more than the rows it saves. The Releases come back whole, as a JSON list per Technology.
export async function listPickerTechnologies(db: Database): Promise<PickerTechnology[]> {
  const rows = db
    .prepare(
      `select t.id, t.slug, t.name, t.description, t.retired, t.category,
         (select json_group_array(json_object('version', r.version, 'published_at', r.published_at))
          from releases r where r.technology_id = t.id) as releases
       from technologies t`,
    )
    .all();
  return z
    .array(PickerRowSchema)
    .parse(rows)
    .map(({ releases, ...technology }) => {
      const latest = latestStableRelease(releases);
      return {
        ...technology,
        latest: latest?.version ?? null,
        latestAt: latest ? isoDay(latest.published_at) : null,
      };
    });
}

// The day, and not the instant: the row prints `latest 8.3.3 on 2026-10-06`, and the ordering reads
// the same string, so both are the same fact seen once.
function isoDay(timestamp: string): string {
  return timestamp.slice(0, 10);
}

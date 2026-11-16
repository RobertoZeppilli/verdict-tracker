import { z } from "zod";
import { sqliteBoolean, sqliteJson } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { ClassificationStrategySchema } from "@/modules/releases";
import { CategorySchema } from "../domain/category";
import { SourceSchema, sourceKey } from "../domain/catalog-entry";
import type { StoredTechnology } from "../domain/plan-catalog-sync";

// A Technology with its Sources in one row: the Sources come as a JSON list built in the query,
// which is what the PostgREST embed `sources (...)` used to hand back. `t` is the alias the
// callers' `where` clauses name.
export const TECHNOLOGY_SELECT = `select t.id, t.slug, t.name, t.description, t.category, t.classification_strategy,
  t.retired,
  (select json_group_array(json_object('id', s.id, 'role', s.role, 'kind', s.kind, 'config', json(s.config),
    'etag', s.etag)) from sources s where s.technology_id = t.id) as sources
  from technologies t`;

const TechnologyRowSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: CategorySchema,
  classification_strategy: ClassificationStrategySchema,
  retired: sqliteBoolean,
  sources: sqliteJson(
    z.array(
      z.object({
        id: z.uuid(),
        role: z.string(),
        kind: z.string(),
        config: z.record(z.string(), z.unknown()),
        etag: z.string().nullable(),
      }),
    ),
  ),
});

// The database stores a Source as role + kind + a JSON config; the domain sees one flat object.
// The list comes back in no particular order, and an `UPDATE` on one Source is enough to change it:
// sorting by role and kind keeps the Technology page stable.
export function toStoredTechnology(row: unknown): StoredTechnology {
  const technology = TechnologyRowSchema.parse(row);
  return {
    id: technology.id,
    slug: technology.slug,
    name: technology.name,
    description: technology.description,
    category: technology.category,
    classificationStrategy: technology.classification_strategy,
    retired: technology.retired,
    sources: technology.sources
      .map(({ id, role, kind, config, etag }) => ({ id, etag, ...SourceSchema.parse({ ...config, role, kind }) }))
      .sort((a, b) => (sourceKey(a) < sourceKey(b) ? -1 : 1)),
  };
}

// The Catalog is curated by hand and sixty rows (issue #190).
export async function readStoredTechnologies(db: Database): Promise<StoredTechnology[]> {
  return db.prepare(TECHNOLOGY_SELECT).all().map(toStoredTechnology);
}

export async function listActiveTechnologies(db: Database): Promise<StoredTechnology[]> {
  return db.prepare(`${TECHNOLOGY_SELECT} where t.retired = 0 order by t.slug`).all().map(toStoredTechnology);
}

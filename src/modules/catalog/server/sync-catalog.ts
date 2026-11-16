import { z } from "zod";
import type { Database } from "@/modules/db/server";
import type { CatalogEntry, Source } from "../domain/catalog-entry";
import { type CatalogSyncOperation, planCatalogSync } from "../domain/plan-catalog-sync";
import { readStoredTechnologies } from "./stored-technologies";

const IdRowSchema = z.object({ id: z.uuid() });

// Not a transaction: every operation is idempotent, so a rerun completes a sync that stopped halfway.
export async function syncCatalog(db: Database, entries: readonly CatalogEntry[]): Promise<CatalogSyncOperation[]> {
  const operations = planCatalogSync(entries, await readStoredTechnologies(db));
  for (const operation of operations) apply(db, operation);
  return operations;
}

function apply(db: Database, operation: CatalogSyncOperation): void {
  const now = new Date().toISOString();
  switch (operation.type) {
    case "insert": {
      const { entry } = operation;
      const row = db
        .prepare(
          `insert into technologies (slug, name, description, category, classification_strategy)
           values (?, ?, ?, ?, ?) returning id`,
        )
        .get(entry.slug, entry.name, entry.description, entry.category, entry.classificationStrategy);
      upsertSources(db, IdRowSchema.parse(row).id, entry.sources);
      return;
    }
    case "update": {
      const { entry } = operation;
      db.prepare(
        `update technologies set name = ?, description = ?, category = ?, classification_strategy = ?, retired = 0,
         updated_at = ? where id = ?`,
      ).run(entry.name, entry.description, entry.category, entry.classificationStrategy, now, operation.technologyId);
      upsertSources(db, operation.technologyId, entry.sources);
      const remove = db.prepare("delete from sources where id = ?");
      for (const id of operation.removedSourceIds) remove.run(id);
      return;
    }
    case "retire": {
      db.prepare("update technologies set retired = 1, updated_at = ? where id = ?").run(now, operation.technologyId);
      return;
    }
  }
}

function upsertSources(db: Database, technologyId: string, sources: readonly Source[]): void {
  const upsert = db.prepare(
    `insert into sources (technology_id, role, kind, config) values (?, ?, ?, ?)
     on conflict (technology_id, role, kind) do update set config = excluded.config`,
  );
  for (const { role, kind, ...config } of sources) upsert.run(technologyId, role, kind, JSON.stringify(config));
}

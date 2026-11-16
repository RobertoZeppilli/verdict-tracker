import type { Database } from "@/modules/db/server";
import type { StoredTechnology } from "../domain/plan-catalog-sync";
import { SlugSchema } from "../domain/catalog-entry";
import { TECHNOLOGY_SELECT, toStoredTechnology } from "./stored-technologies";

// Retired Technologies are returned too: their public pages stay online (ADR 0005).
export async function getTechnology(db: Database, slug: string): Promise<StoredTechnology | null> {
  if (!SlugSchema.safeParse(slug).success) return null;
  const row = db.prepare(`${TECHNOLOGY_SELECT} where t.slug = ?`).get(slug);
  return row === undefined ? null : toStoredTechnology(row);
}

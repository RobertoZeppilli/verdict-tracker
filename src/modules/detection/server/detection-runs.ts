import { z } from "zod";
import type { Database } from "@/modules/db/server";

const LastRowSchema = z.object({ finished_at: z.string().nullable() });

export function readLastDetection(db: Database): Date | null {
  const row = LastRowSchema.parse(db.prepare("select max(finished_at) as finished_at from detection_runs").get());
  return row.finished_at === null ? null : new Date(row.finished_at);
}

export function recordDetection(db: Database, finishedAt: Date): void {
  db.prepare("insert into detection_runs (finished_at) values (?)").run(finishedAt.toISOString());
}

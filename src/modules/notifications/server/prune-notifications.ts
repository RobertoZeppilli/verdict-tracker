import type { Database } from "@/modules/db/server";

// A Notification is kept 90 days (ADR 0009), and the privacy notice says so: a retention declared on
// a public page and not applied is a page that lies, so the deletion runs with the daily job.
export const RETENTION_DAYS = 90;

export async function pruneNotifications(db: Database, now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return Number(db.prepare("delete from notifications where created_at < ?").run(before).changes);
}

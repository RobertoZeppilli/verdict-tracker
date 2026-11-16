import { z } from "zod";
import type { Database } from "@/modules/db/server";
import type { FeedItem } from "../domain/feed";

// How many the panel holds. The number on the bell counts every unseen Notification, so a Developer
// with more than this reads the latest here and clears the rest with one press (see `seeAll`).
export const PAGE = 20;

// The bell lists the two Release events and counts the same two. The weekly Digest is a row of the
// same table (ADR 0009) and arrives with #173, which is what gives it a line to be printed on: a
// number that counted it before then would stand over a panel that could not show it.
const SHOWN = "event in ('featured_release', 'notable_release')";

const RowSchema = z.object({
  id: z.uuid(),
  event: z.enum(["featured_release", "notable_release"]),
  created_at: z.iso.datetime({ offset: true }),
  seen_at: z.iso.datetime({ offset: true }).nullable(),
  version: z.string(),
  name: z.string(),
  slug: z.string(),
});

export function readUnseen(db: Database): number {
  const row = db.prepare(`select count(*) as unseen from notifications where ${SHOWN} and seen_at is null`).get();
  return z.object({ unseen: z.number() }).parse(row).unseen;
}

// A Release event always has a Release, and that Release always has a Technology.
export function readFeed(db: Database): FeedItem[] {
  const rows = db
    .prepare(
      `select n.id, n.event, n.created_at, n.seen_at, r.version, t.name, t.slug
       from notifications n
       join releases r on r.id = n.release_id
       join technologies t on t.id = r.technology_id
       where n.${SHOWN}
       order by n.created_at desc
       limit ?`,
    )
    .all(PAGE);
  return z
    .array(RowSchema)
    .parse(rows)
    .map((row) => ({
      id: row.id,
      event: row.event,
      technologyName: row.name,
      slug: row.slug,
      version: row.version,
      createdAt: new Date(row.created_at),
      seen: row.seen_at !== null,
    }));
}

// `seen_at is null` on the write, so the day a Notification was first Seen is never rewritten by a
// second press. No id clears every unseen row, not only the page the panel holds: the number the
// bell shows is the number this clears.
export function writeSeen(db: Database, id: string | null): void {
  db.prepare(
    `update notifications set seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     where ${SHOWN} and seen_at is null and (?1 is null or id = ?1)`,
  ).run(id);
}

"use client";

import { z } from "zod";
import { STATIC_SITE } from "@/lib/static-site";
import { type FeedItem } from "../domain/feed";

// Read in the browser: a server read would make every page dynamic, and the bell lives in the bar
// of all of them. The browser asks `/api/notifications`, as it asks `/api/follows` (issue #211).
// The showcase has no server and nobody to notify, so there the bell reads as empty.
const ENDPOINT = "/api/notifications";

const FeedSchema = z.array(
  z.object({
    id: z.uuid(),
    event: z.enum(["featured_release", "notable_release"]),
    technologyName: z.string(),
    slug: z.string(),
    version: z.string(),
    createdAt: z.iso.datetime({ offset: true }).transform((at) => new Date(at)),
    seen: z.boolean(),
  }),
);

export async function fetchUnseen(): Promise<number> {
  if (STATIC_SITE) return 0;
  return z.object({ unseen: z.number() }).parse(await read(ENDPOINT)).unseen;
}

export async function fetchFeed(): Promise<FeedItem[]> {
  if (STATIC_SITE) return [];
  return FeedSchema.parse(await read(`${ENDPOINT}?list`));
}

export function writeSeen(id: string): Promise<void> {
  return seen(id);
}

// Every unseen row, not only the page the panel holds: the number the bell shows is the number
// this clears.
export function writeAllSeen(): Promise<void> {
  return seen(null);
}

async function read(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`notifications: ${response.status}`);
  return response.json();
}

async function seen(id: string | null): Promise<void> {
  if (STATIC_SITE) return;
  const response = await fetch(ENDPOINT, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error(`notifications: ${response.status}`);
}

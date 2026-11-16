"use client";

import { z } from "zod";
import {
  type CurrentVersion,
  CurrentVersionRejectedError,
  type Follow,
} from "../domain/current-version";
import { FollowRejectedError } from "../domain/follow-rejection";

// Follows are the one thing a Developer writes. The browser asks `/api/follows`, which holds the
// rules the database used to hold, and a refusal (issue #18) comes back as the reason itself. No row
// carries whose it is: an installed copy belongs to one person (issue #210, ADR 0011).
export const FOLLOWS_KEY = ["follows"] as const;

const ENDPOINT = "/api/follows";

const CurrentVersionSchema = z
  .object({ version: z.string(), declaredAt: z.iso.datetime({ offset: true }) })
  .transform(({ version, declaredAt }) => ({ version, declaredAt: new Date(declaredAt) }));

const FollowsSchema = z.array(z.object({ technologyId: z.uuid(), currentVersion: CurrentVersionSchema.nullable() }));

const RejectedSchema = z.object({ rejection: z.enum(["retired", "unknown"]) });

const DeclaredSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), currentVersion: CurrentVersionSchema.nullable() }),
  z.object({ ok: z.literal(false), decline: z.enum(["malformed", "notOlder", "noStable", "denied"]) }),
]);

export async function fetchFollows(): Promise<Follow[]> {
  const response = await fetch(ENDPOINT);
  if (!response.ok) throw new Error(`follows: ${response.status}`);
  return FollowsSchema.parse(await response.json());
}

export function writeFollow(technologyId: string, follow: boolean): Promise<void> {
  return send([technologyId], follow);
}

// Several follows in one request and one transaction, which is what makes a refusal a fact about
// the group: nothing is followed halfway.
export function writeFollows(technologyIds: string[]): Promise<void> {
  return send(technologyIds, true);
}

async function send(technologyIds: string[], follow: boolean): Promise<void> {
  const response = await call("POST", { technologyIds, follow });
  if (response?.ok) return;
  // A lost connection or an answer that is not a refusal is `unknown`: the remedy is to try again.
  const refused = RejectedSchema.safeParse(await response?.json().catch(() => null));
  const rejection = refused.success ? refused.data.rejection : "unknown";
  throw new FollowRejectedError(rejection, `follow refused: ${rejection}`);
}

// `null` takes the declaration away. The row comes back because the day it was declared is written
// by the server, not by the browser: only an answer can say when the declaration now stands from.
export async function writeCurrentVersion(technologyId: string, version: string | null): Promise<CurrentVersion | null> {
  const response = await call("PATCH", { technologyId, version });
  const declared = DeclaredSchema.safeParse(await response?.json().catch(() => null));
  if (!declared.success) throw new CurrentVersionRejectedError("denied", "declaration failed");
  if (!declared.data.ok) throw new CurrentVersionRejectedError(declared.data.decline, `declaration refused: ${declared.data.decline}`);
  return declared.data.currentVersion;
}

async function call(method: "POST" | "PATCH", body: object): Promise<Response | null> {
  return fetch(ENDPOINT, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

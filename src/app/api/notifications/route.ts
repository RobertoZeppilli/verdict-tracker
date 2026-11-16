import { z } from "zod";
import { getDatabase } from "@/modules/db/server";
import { readFeed, readUnseen, writeSeen } from "@/modules/notifications/server";

// The bell of the installed app, read and written by the browser through here, as `/api/follows`
// is (issue #211). Not in the showcase: `build-static` drops `src/app/api` whole.

// `?list` reads the panel; without it, only the number on the bell.
export async function GET(request: Request): Promise<Response> {
  const db = getDatabase();
  if (new URL(request.url).searchParams.has("list")) return Response.json(readFeed(db));
  return Response.json({ unseen: readUnseen(db) });
}

const SeenBody = z.object({ id: z.uuid().nullable() });

// ⚠️ JSON only, the same guard against another site as `/api/follows`: a cross-origin request with
// this content type needs a CORS preflight, which nothing here answers.
export async function PATCH(request: Request): Promise<Response> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const body = SeenBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  writeSeen(getDatabase(), body.data.id);
  return new Response(null, { status: 204 });
}

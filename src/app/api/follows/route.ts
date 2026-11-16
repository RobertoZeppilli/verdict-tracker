import { z } from "zod";
import { getDatabase } from "@/modules/db/server";
import { readFollows, writeCurrentVersion, writeFollows } from "@/modules/follows/server";

// The follows of the installed app, read and written by the browser through here since the data
// moved into a file on this machine (issue #211). Not in the showcase: `build-static` drops
// `src/app/api` whole, and the provider asks nothing there.

const FollowBody = z.object({ technologyIds: z.array(z.uuid()).min(1), follow: z.boolean() });
const DeclareBody = z.object({ technologyId: z.uuid(), version: z.string().max(100).nullable() });

export async function GET(): Promise<Response> {
  return Response.json(await readFollows(getDatabase()));
}

export async function POST(request: Request): Promise<Response> {
  const body = await parse(request, FollowBody);
  if (body === null) return Response.json({ error: "bad request" }, { status: 400 });
  const rejection = writeFollows(getDatabase(), body.technologyIds, body.follow);
  return rejection === null ? new Response(null, { status: 204 }) : Response.json({ rejection }, { status: 409 });
}

export async function PATCH(request: Request): Promise<Response> {
  const body = await parse(request, DeclareBody);
  if (body === null) return Response.json({ error: "bad request" }, { status: 400 });
  const declared = await writeCurrentVersion(getDatabase(), body.technologyId, body.version);
  return Response.json(declared, { status: declared.ok ? 200 : 409 });
}

// ⚠️ JSON only, and that is the guard against another site posting to this machine: a cross-origin
// request with this content type needs a CORS preflight, which nothing here answers.
async function parse<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | null> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return null;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

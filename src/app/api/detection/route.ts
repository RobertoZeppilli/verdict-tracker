import { z } from "zod";
import { startDetection } from "@/lib/run-detection";

// Started by the Dashboard (issue #213): on opening, with `force: false`, it runs only when the data
// is stale; the Refresh button sends `force: true`. Not in the showcase: `build-static` drops
// `src/app/api` whole.
const Body = z.object({ force: z.boolean() });

export async function POST(request: Request): Promise<Response> {
  // ⚠️ JSON only, the same guard as `/api/follows`: a cross-origin request with this content type
  // needs a CORS preflight, which nothing here answers, so another site cannot start a run that spends.
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(await startDetection(body.data));
}

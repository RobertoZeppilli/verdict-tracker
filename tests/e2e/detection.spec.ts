import { expect, test } from "@playwright/test";

// The Detection spends on the Summaries it writes (issue #212), and since #213 the browser starts it.
// What keeps another site from starting it is the JSON content type, which a cross-origin request
// cannot send without a preflight: anything else is refused before a run begins.
test.describe("/api/detection", () => {
  test("refuses a form post and a body without force", async ({ request, baseURL }) => {
    const headers = { origin: String(baseURL) };
    expect((await request.post("/api/detection", { form: { force: "true" }, headers })).status()).toBe(400);
    expect((await request.post("/api/detection", { data: {}, headers })).status()).toBe(400);
  });

  // Issue #239: the proxy answers before the route does, for another site and for a rebound domain.
  test("refuses a write from another origin or another Host", async ({ request, baseURL }) => {
    const data = { force: true };
    expect((await request.post("/api/detection", { data })).status()).toBe(403);
    expect((await request.post("/api/detection", { data, headers: { origin: "https://evil.example" } })).status()).toBe(403);
    const host = { host: `evil.example:${new URL(String(baseURL)).port}` };
    expect((await request.get("/api/follows", { headers: host })).status()).toBe(403);
    expect((await request.get("/slack/install", { headers: host, maxRedirects: 0 })).status()).toBe(403);
  });

  test("is gone as a GET", async ({ request }) => {
    expect((await request.get("/api/detection")).status()).toBe(405);
  });
});

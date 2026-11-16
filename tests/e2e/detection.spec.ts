import { expect, test } from "@playwright/test";

// The Detection spends on the Summaries it writes (issue #212), and since #213 the browser starts it.
// What keeps another site from starting it is the JSON content type, which a cross-origin request
// cannot send without a preflight: anything else is refused before a run begins.
test.describe("/api/detection", () => {
  test("refuses a form post and a body without force", async ({ request }) => {
    expect((await request.post("/api/detection", { form: { force: "true" } })).status()).toBe(400);
    expect((await request.post("/api/detection", { data: {} })).status()).toBe(400);
  });

  test("is gone as a GET", async ({ request }) => {
    expect((await request.get("/api/detection")).status()).toBe(405);
  });
});

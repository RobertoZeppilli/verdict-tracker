import { expect, test } from "@playwright/test";

// The job endpoints. They write, and the Detection spends on the Summaries it writes (issue #212),
// so the address alone must never be enough: the secret is asked for first.
const endpoints = ["/api/jobs/detection"];

test.describe("job endpoints", () => {
  for (const endpoint of endpoints) {
    test(`${endpoint} refuses a request without the secret`, async ({ request }) => {
      expect((await request.get(endpoint)).status()).toBe(401);
      expect((await request.get(endpoint, { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    });
  }
});

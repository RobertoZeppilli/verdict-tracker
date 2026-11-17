import "server-only";

import { parseServerEnv } from "./parse-env";

export type { ServerEnv } from "./parse-env";

export const serverEnv = parseServerEnv({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  E2E_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
  VERDICT_WEBHOOK_URL: process.env.VERDICT_WEBHOOK_URL,
});

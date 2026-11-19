import "server-only";

import { parseServerEnv } from "./parse-env";

export type { ServerEnv } from "./parse-env";

export const serverEnv = parseServerEnv({
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  VERDICT_MODEL_URL: process.env.VERDICT_MODEL_URL,
  VERDICT_MODEL: process.env.VERDICT_MODEL,
  VERDICT_MODEL_KEY: process.env.VERDICT_MODEL_KEY,
  VERDICT_MODEL_CONTEXT: process.env.VERDICT_MODEL_CONTEXT,
  E2E_AUTH_SECRET: process.env.E2E_AUTH_SECRET,
  VERDICT_WEBHOOK_URL: process.env.VERDICT_WEBHOOK_URL,
  VERDICT_VAULT_DIR: process.env.VERDICT_VAULT_DIR,
});

import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  // `1` while the public showcase is being built (issue #215), unset for the app with the server.
  // Declared here because every variable is declared here; it is read from `src/lib/static-site.ts`
  // instead of from `env`, and that file says why.
  NEXT_PUBLIC_STATIC_SITE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.literal("1").optional(),
  ),
});

// Server-only: never read these from a module that can reach the client bundle.
const ServerEnvSchema = z.object({
  // Raises GitHub's limit from 60 requests an hour; the Detection reads notes only for new Releases.
  GITHUB_TOKEN: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  // Only for the end-to-end tests: it is what /api/test/revalidate and /test/throw ask for before
  // they answer at all. Never set in production, where both are a 404.
  // ⚠️ **It stays, and it keeps its name**, although issue #210 lists it with the three variables
  // of the login. The three were the login; this one only shared its prefix, and what it guards --
  // dropping a cached render, and a page that throws on purpose -- has nothing to do with signing
  // in. Removing it would not remove a login, it would remove a guard and leave two test-only
  // routes answering in production. Renaming it to `E2E_SECRET` would be right and costs one line
  // in `.github/workflows/ci.yml`, which is a file this branch may not touch.
  E2E_AUTH_SECRET: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(32).optional()),
  // The model that writes the Summaries (issue #280), any server that speaks the chat completions of
  // OpenAI: Ollama on this computer by default, or a remote provider with its key. Without
  // VERDICT_MODEL there is no writer and the Summaries stay `pending`; the app still starts.
  VERDICT_MODEL_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().default("http://localhost:11434/v1")),
  VERDICT_MODEL: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  VERDICT_MODEL_KEY: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  // The context the model runs with, in tokens: notes that would not fit are refused, not cut.
  VERDICT_MODEL_CONTEXT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  // `verdict-tracker sync --notify` on a GitHub runner (issue #218): a Slack or Discord webhook, which
  // wins over the one saved in `/settings`. Optional: the app on a laptop saves its own. The prefixes
  // are `isSlackWebhook` and `isDiscordWebhook` again, written out because `next.config` loads this
  // file without the `@/` alias.
  VERDICT_WEBHOOK_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^https:\/\/(hooks\.slack\.com\/services|discord\.com\/api\/webhooks)\/./, "a Slack or Discord webhook URL")
      .optional(),
  ),
  // The Obsidian vault the Releases that need action are written into (issue #242). Unset: nothing is
  // written. A folder that does not exist is reported at startup, not refused here.
  VERDICT_VAULT_DIR: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
});

export type Env = z.infer<typeof EnvSchema>;
export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export class InvalidEnvError extends Error {
  constructor(issues: readonly z.core.$ZodIssue[]) {
    const lines = issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    super(
      [
        "Invalid environment variables:",
        ...lines,
        "Copy .env.example to .env.local and fill in the values.",
      ].join("\n"),
    );
    this.name = "InvalidEnvError";
  }
}

function parseWith<T>(schema: z.ZodType<T>, source: Record<string, string | undefined>): T {
  const result = schema.safeParse(source);
  if (!result.success) throw new InvalidEnvError(result.error.issues);
  return result.data;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseWith(EnvSchema, source);
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return parseWith(ServerEnvSchema, source);
}

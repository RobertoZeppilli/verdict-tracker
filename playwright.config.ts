import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// The app under test and the fixtures open the same data file, in a folder of its own: a run never
// writes into the install of whoever runs it (issue #211). The workers and the web server inherit it.
process.env.VERDICT_DATA_DIR ||= ".e2e-data";
// The same for the vault (issue #242): the fixtures follow Technologies whose Summaries ask for
// action, and a VERDICT_VAULT_DIR from `.env.local` would get their notes. Empty and not deleted:
// Next does not override a variable already set, and the schema reads "" as unset.
process.env.VERDICT_VAULT_DIR = "";
// And for the webhook (#291): one in `.env.local` would get the messages of every run, and replaces
// the field of `/settings` that the suite saves into.
process.env.VERDICT_WEBHOOK_URL = "";
// The app ignores the vault on a GitHub runner (`vaultDir()`, issue #244), where `verdict-tracker sync`
// cannot see it. The CI of this repo is a runner too, but the app under test is not a sync: without
// this the vault saved by `vault-settings.spec.ts` would never be written.
process.env.GITHUB_ACTIONS = "";

// ⚠️ The suite always starts its own server, never one already on the port: a `pnpm dev` of yours
// reads your data file and your vault, not `.e2e-data`, and a server of another project reads as
// dozens of unrelated failures. With the port taken the run stops at once: `E2E_PORT` gives it
// another one when another project holds it, while a `pnpm dev` of this one has to be stopped, since
// Next runs one dev server per folder.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: isCI,
  // ⚠️ **Un worker solo, dalla #210.** Follows e Notifications appartenevano a uno Sviluppatore, e
  // ogni file ne seminava uno suo: era quello a isolare due file in parallelo. Adesso le righe sono
  // una tabella sola per la copia installata, e il numero sulla campanella le conta tutte, quindi
  // due file insieme si cancellano le righe a vicenda e il conteggio di uno è la somma di due. Non
  // basta restringere il `clear` alla Tecnologia del test: il numero resta globale. Misurato il
  // 2026-11-12: la suite intera ci mette 2,9 minuti in serie, gli stessi di prima in parallelo,
  // perché il tempo se ne va ad aspettare le pagine e non a calcolare.
  workers: 1,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // CI runs against the production build, locally against the dev server.
  webServer: {
    command: isCI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});

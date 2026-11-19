#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { DEFAULT_PORT, dataDirectory, initialFileUrl, nextSyncState, parseSyncState, postJson } from "./launch.mjs";

// `npx verdict-tracker` (issue #214): the data file in place, then the standalone server of Next on
// localhost, then the browser.
// `npx verdict-tracker sync [--notify]` (issue #218): the same server for the length of one run, with
// no browser, for a GitHub workflow that sends Slack or Discord what is new while the app is closed.

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..", "app");
const { version } = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(`Verdict needs Node.js 24 or later; this is ${process.version}. https://nodejs.org`);
  process.exit(1);
}

const directory = dataDirectory({ platform: process.platform, home: homedir(), env: process.env, cwd: process.cwd() });
const database = join(directory, "verdict.db");

// ⚠️ `exitCode` and not `process.exit`: on Windows, exiting while `fetch` closes its handles trips
// an assertion in libuv and the command dies with 127 instead of the message.
const [command, ...flags] = process.argv.slice(2);
if (command !== undefined && command !== "sync") {
  console.error("Usage: verdict-tracker [sync [--notify]]");
  process.exitCode = 1;
} else if (!existsSync(database) && !(await download())) process.exitCode = 1;
else if (command === "sync") await sync(flags.includes("--notify"));
else await start();

// First run only: the next one finds the file and downloads nothing. Written aside and renamed, so
// an interrupted download never leaves a half file that the next run would take as the real one.
async function download() {
  const url = initialFileUrl(version);
  console.log(`First run: downloading the initial data from ${url}`);
  mkdirSync(directory, { recursive: true });
  const partial = `${database}.download`;
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`GitHub answered ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    renameSync(partial, database);
    return true;
  } catch (error) {
    rmSync(partial, { force: true });
    console.error(`Could not download the initial data: ${error instanceof Error ? error.message : error}`);
    console.error("Check the connection and run the command again.");
    return false;
  }
}

async function start() {
  const port = (await isFree(DEFAULT_PORT)) ? DEFAULT_PORT : await anyFreePort();
  const url = `http://localhost:${port}`;
  const server = serve(port);
  server.on("exit", (code) => process.exit(code ?? 0));

  await waitFor(url);
  console.log(`\nVerdict is running at ${url}  (data: ${directory}, Ctrl+C to stop)\n`);
  openBrowser(`${url}/dashboard`);
}

// One Refresh, as the Dashboard's button does it, so the run has one road (`runOnce`). `--notify` is
// the rule of `docs/DECISIONI.md` for a run nobody watches: without a key the Notifications do not
// wait for Summaries, and `verdict-sync.json` remembers what went out.
/** @param {boolean} notify */
async function sync(notify) {
  const port = await anyFreePort();
  const url = `http://localhost:${port}`;
  const server = serve(port);
  const stateFile = join(directory, "verdict-sync.json");
  const previous = parseSyncState(existsSync(stateFile) ? readFileSync(stateFile, "utf8") : null);
  try {
    await waitFor(url);
    // `origin` is what the proxy asks of a request that writes (`src/lib/trusted-request.ts`).
    const response = await postJson(
      `${url}/api/detection`,
      { origin: url },
      { force: true, ...(notify ? { notify: { sent: Object.keys(previous.sent) } } : {}) },
    );
    if (response.status !== 200) throw new Error(`the app answered ${response.status}`);
    const run = JSON.parse(response.text);
    console.log(`Detection: ${run.detected.length} new Releases, ${run.failed.length} Technologies not reached`);
    console.log(
      run.summaryKey
        ? `Summaries: ${run.summaries.ready.length} written, ${run.summaries.failed.length} failed`
        : "Summaries: missing, ANTHROPIC_API_KEY is not set. Notifications go out without them.",
    );
    // `planned` counts the ones already there too: the insert skips those.
    console.log(`Notifications: ${run.notifications.planned} for the Releases you follow`);
    console.log(
      run.slack.failed > 0
        ? "Webhook: the send failed, see the reason in /settings or check VERDICT_WEBHOOK_URL"
        : `Webhook: ${run.slack.sent} sent`,
    );
    if (notify) writeFileSync(stateFile, `${JSON.stringify(nextSyncState(previous, run.slack.delivered, new Date()), null, 2)}\n`);
    // A red run in the Actions tab is how a broken webhook gets noticed with nobody looking.
    if (run.slack.failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`The run did not complete: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
}

/** @param {number} port */
function serve(port) {
  // The Anthropic key, for whoever prefers a file to a variable in the shell. A variable already set
  // in the shell wins over the file.
  const envFile = join(directory, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  // ⚠️ `HOSTNAME` is where the standalone server listens, and its default is every interface: with no
  // login, anyone on the same network would open the app and spend the key (issue #239).
  // `localhost` and not `127.0.0.1`: the proxy rewrites to a `localhost` URL, and a standalone server
  // bound to another name takes that for an outside address and loops through its own proxy (a 308
  // on every English page, measured). Both names are loopback only.
  return spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.js"], {
    cwd: APP,
    stdio: "inherit",
    // `VERDICT_DATA_DIR` already resolved: the server runs from `app/`, so a relative one (the
    // workflow's `.`) would name another directory there.
    env: { ...process.env, VERDICT_DATA_DIR: directory, PORT: String(port), HOSTNAME: "localhost", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" },
  });
}

/** @param {number} port */
function isFree(port) {
  return new Promise((done) => {
    const probe = createServer()
      .once("error", () => done(false))
      .listen(port, "localhost", () => probe.close(() => done(true)));
  });
}

/** @returns {Promise<number>} */
function anyFreePort() {
  return new Promise((done, fail) => {
    const probe = createServer()
      .once("error", fail)
      .listen(0, "localhost", () => {
        const address = probe.address();
        probe.close(() => (typeof address === "object" && address ? done(address.port) : fail(new Error("no port"))));
      });
  });
}

/** @param {string} url */
async function waitFor(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      await fetch(url, { method: "HEAD" });
      return;
    } catch {
      await new Promise((wait) => setTimeout(wait, 250));
    }
  }
}

/** @param {string} url */
function openBrowser(url) {
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", '""', url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  // A machine with no browser (a server over SSH) still has the address printed above.
  spawn(command, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

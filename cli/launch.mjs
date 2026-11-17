import { posix, win32 } from "node:path";

// The pure half of the launcher (issue #214), apart so it can be tested. Plain JavaScript because
// npx runs it as it is, from inside `node_modules`, where Node strips no types.

export const DEFAULT_PORT = 7357;
export const REPOSITORY = "RobertoZeppilli/verdict-tracker";

/**
 * The directory of the data file. ⚠️ A copy of `databaseFile` in
 * `src/modules/db/domain/database-file.ts`, which the server reads: the two must agree, and
 * `launch.test.ts` checks that they do.
 * @param {{ platform: NodeJS.Platform, home: string, env: Partial<Record<string, string>>, cwd: string }} where
 */
export function dataDirectory({ platform, home, env, cwd }) {
  const path = platform === "win32" ? win32 : posix;
  const chosen = env.VERDICT_DATA_DIR?.trim();
  if (chosen) return path.resolve(cwd, chosen);
  if (platform !== "win32") return path.join(home, ".verdict");
  return path.join(env.LOCALAPPDATA?.trim() || path.join(home, "AppData", "Local"), "verdict");
}

/**
 * The initial data file of this version: the Catalog, its Releases and the Summaries already paid
 * for, attached to the GitHub Release of the same tag by `.github/workflows/release.yml`.
 * @param {string} version
 */
export function initialFileUrl(version) {
  return `https://github.com/${REPOSITORY}/releases/download/v${version}/verdict.db`;
}

// `verdict-sync.json`, which the workflow of `sync --notify` commits (issue #218): when the cached
// database is gone, it is what keeps a fresh download from sending the same Releases again.
const KEEP_DAYS = 30;

/**
 * What the file says, or an empty state when it is missing or not ours: at worst a Release is sent
 * twice, which is better than a run that stops on a file somebody edited by hand.
 * @param {string | null} text
 * @returns {{ lastRun: string | null, sent: Record<string, string> }}
 */
export function parseSyncState(text) {
  try {
    const { lastRun, sent } = JSON.parse(text ?? "");
    const entries = Object.entries(sent ?? {}).filter(([, at]) => typeof at === "string");
    return { lastRun: typeof lastRun === "string" ? lastRun : null, sent: Object.fromEntries(entries) };
  } catch {
    return { lastRun: null, sent: {} };
  }
}

/**
 * The state after a run: what went out joins what was there, and what is older than the window of
 * a Notification leaves, so the file does not grow for ever.
 * @param {{ sent: Record<string, string> }} previous
 * @param {readonly string[]} delivered `slug@version`
 * @param {Date} now
 */
export function nextSyncState(previous, delivered, now) {
  const oldest = now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const kept = Object.entries(previous.sent).filter(([, at]) => Date.parse(at) >= oldest);
  const added = delivered.map((key) => [key, now.toISOString()]);
  return { lastRun: now.toISOString(), sent: Object.fromEntries([...kept, ...added].sort()) };
}

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

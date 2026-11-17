import { describe, expect, it } from "vitest";
import { databaseFile } from "@/modules/db";
import { dataDirectory, nextSyncState, parseSyncState } from "./launch.mjs";

// The launcher downloads the initial file where the server will look for it: one path, two copies.
describe("dataDirectory", () => {
  const cases = [
    { platform: "linux", home: "/home/ada", env: {} },
    { platform: "darwin", home: "/Users/ada", env: {} },
    { platform: "win32", home: "C:\\Users\\ada", env: { LOCALAPPDATA: "D:\\Local" } },
    { platform: "win32", home: "C:\\Users\\ada", env: { LOCALAPPDATA: " " } },
    { platform: "linux", home: "/home/ada", env: { VERDICT_DATA_DIR: "data" } },
    { platform: "linux", home: "/home/ada", env: { VERDICT_DATA_DIR: "/srv/verdict" } },
    { platform: "linux", home: "/home/ada", env: { VERDICT_DATA_DIR: "  " } },
  ] as const;

  it.each(cases)("agrees with the server on $platform $env", (where) => {
    const location = { ...where, cwd: where.platform === "win32" ? "C:\\work" : "/work" };
    const path = where.platform === "win32" ? "\\" : "/";
    expect(`${dataDirectory(location)}${path}verdict.db`).toBe(databaseFile(location));
  });
});

describe("the state of sync --notify", () => {
  const now = new Date("2026-11-17T07:00:00.000Z");

  it("adds what went out and drops what is older than thirty days", () => {
    const previous = parseSyncState(
      JSON.stringify({ lastRun: "x", sent: { "old@1.0.0": "2026-10-01T07:00:00.000Z", "react@19.0.0": "2026-11-16T07:00:00.000Z" } }),
    );
    expect(nextSyncState(previous, ["next@16.1.0"], now)).toEqual({
      lastRun: now.toISOString(),
      sent: { "next@16.1.0": now.toISOString(), "react@19.0.0": "2026-11-16T07:00:00.000Z" },
    });
  });

  it("starts empty from a missing or broken file instead of stopping", () => {
    expect(parseSyncState(null)).toEqual({ lastRun: null, sent: {} });
    expect(parseSyncState("{not json")).toEqual({ lastRun: null, sent: {} });
  });
});

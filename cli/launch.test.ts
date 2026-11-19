import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseFile } from "@/modules/db";
import { dataDirectory, nextSyncState, parseSyncState, postJson } from "./launch.mjs";

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

// `fetch` gives up on a response after 300 s, and a run with many Summaries takes longer (issue #261).
describe("postJson", () => {
  afterEach(() => vi.useRealTimers());

  it("waits for a run that answers after more than five minutes", async () => {
    let answer: ServerResponse | undefined;
    const server = createServer((_, res) => (answer = res));
    await new Promise<void>((done) => server.listen(0, "localhost", done));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("expected a port");
    const { port } = address;

    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval"] });
    const response = postJson(`http://localhost:${port}/api/detection`, { origin: "x" }, { force: true });
    await vi.waitFor(() => expect(answer).toBeDefined(), { interval: 10 });
    vi.advanceTimersByTime(6 * 60 * 1000);
    answer?.writeHead(200, { "content-type": "application/json" }).end('{"ran":true}');

    await expect(response).resolves.toEqual({ status: 200, text: '{"ran":true}' });
    server.close();
  });
});

import { describe, expect, it } from "vitest";
import { databaseFile } from "@/modules/db";
import { dataDirectory } from "./launch.mjs";

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

import { describe, expect, it } from "vitest";
import { readLastDetection, recordDetection } from "@/modules/detection/server";
import { testDatabase } from "./database";

// Issue #213: the end of the last Detection is what decides whether opening the Dashboard starts one.
describe("detection runs", () => {
  it("has no last Detection on a fresh install", () => {
    expect(readLastDetection(testDatabase())).toBeNull();
  });

  it("reads back the latest end, whatever the order of the writes", () => {
    const db = testDatabase();
    recordDetection(db, new Date("2026-11-16T10:00:00Z"));
    recordDetection(db, new Date("2026-11-16T04:00:00Z"));
    expect(readLastDetection(db)).toEqual(new Date("2026-11-16T10:00:00Z"));
  });
});

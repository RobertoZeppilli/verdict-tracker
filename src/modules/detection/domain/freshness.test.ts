import { describe, expect, it } from "vitest";
import { isDetectionStale } from "./freshness";

const now = new Date("2026-11-16T12:00:00Z");

describe("isDetectionStale", () => {
  it("is stale when no Detection ever ran", () => {
    expect(isDetectionStale(null, now)).toBe(true);
  });

  it("is fresh under six hours", () => {
    expect(isDetectionStale(new Date("2026-11-16T06:00:01Z"), now)).toBe(false);
  });

  it("is stale at six hours", () => {
    expect(isDetectionStale(new Date("2026-11-16T06:00:00Z"), now)).toBe(true);
  });
});

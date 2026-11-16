import { describe, expect, it } from "vitest";

import { mergeStateFile, parseStateFile, serializeStateFile } from "./state-file";

describe("parseStateFile", () => {
  it("reads a follow with nothing declared and one with its Version in use", () => {
    const text = '{ "follows": { "vite": {}, "next": { "currentVersion": "16.0.0", "declaredAt": "2026-11-01T10:00:00.000Z" } } }';
    expect(parseStateFile(text)).toEqual({
      ok: true,
      state: {
        follows: { vite: {}, next: { currentVersion: "16.0.0", declaredAt: "2026-11-01T10:00:00.000Z" } },
      },
    });
  });

  it("drops a field it does not know instead of refusing the file", () => {
    expect(parseStateFile('{ "follows": { "vite": { "version": "7.0.0" } } }')).toEqual({
      ok: true,
      state: { follows: { vite: {} } },
    });
  });

  it("says why a file is not valid", () => {
    expect(parseStateFile("{ follows")).toMatchObject({ ok: false });
    expect(parseStateFile('{ "follows": ["vite"] }')).toMatchObject({ ok: false });
    expect(parseStateFile('{ "follows": { "vite": { "declaredAt": "yesterday" } } }')).toMatchObject({ ok: false });
  });
});

describe("serializeStateFile", () => {
  it("sorts the slugs and ends with a newline", () => {
    expect(serializeStateFile({ follows: { vite: {}, next: {} } })).toBe(
      '{\n  "follows": {\n    "next": {},\n    "vite": {}\n  }\n}\n',
    );
  });
});

describe("mergeStateFile", () => {
  it("takes what the database follows and keeps the slugs it does not know", () => {
    const previous = { follows: { vite: {}, next: { currentVersion: "15.0.0" }, mystery: {} } };
    const merged = mergeStateFile(previous, { next: { currentVersion: "16.0.0" } }, new Set(["vite", "next"]));
    expect(merged).toEqual({ follows: { mystery: {}, next: { currentVersion: "16.0.0" } } });
  });
});

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeNotes } from "./write-vault-notes";

let vault: string;

beforeEach(() => {
  vault = mkdtempSync(join(tmpdir(), "verdict-vault-"));
});

afterEach(() => {
  rmSync(vault, { recursive: true, force: true });
});

const read = (path: string) => readFileSync(join(vault, path), "utf8");

describe("writeNotes", () => {
  it("writes the new notes", () => {
    const report = writeNotes(vault, [{ path: "Verdict/Next.js/16.0.0.md", content: "new" }]);
    expect(report).toEqual({ written: ["Verdict/Next.js/16.0.0.md"], skipped: [], failed: [] });
    expect(read("Verdict/Next.js/16.0.0.md")).toBe("new");
  });

  it("never touches a note that already exists, edited by hand", () => {
    writeNotes(vault, [{ path: "Verdict/Next.js/16.0.0.md", content: "new" }]);
    writeFileSync(join(vault, "Verdict/Next.js/16.0.0.md"), "new\n\nmy own notes");
    const report = writeNotes(vault, [{ path: "Verdict/Next.js/16.0.0.md", content: "new" }]);
    expect(report.skipped).toEqual(["Verdict/Next.js/16.0.0.md"]);
    expect(read("Verdict/Next.js/16.0.0.md")).toBe("new\n\nmy own notes");
  });

  it("writes a deleted note again", () => {
    writeNotes(vault, [{ path: "Verdict/Next.js/16.0.0.md", content: "new" }]);
    rmSync(join(vault, "Verdict/Next.js/16.0.0.md"));
    expect(writeNotes(vault, [{ path: "Verdict/Next.js/16.0.0.md", content: "new" }]).written).toHaveLength(1);
  });

  it.each(["Verdict/../outside.md", "../outside.md", "Other/x.md", "Verdict"])("refuses %j, outside Verdict/", (path) => {
    const report = writeNotes(vault, [{ path, content: "x" }]);
    expect(report.written).toEqual([]);
    expect(report.failed).toMatchObject([{ path }]);
  });

  it("goes on past a file it cannot write", () => {
    // A file where the Technology's folder should be: nothing can be written under it.
    mkdirSync(join(vault, "Verdict"));
    writeFileSync(join(vault, "Verdict/Blocked"), "");
    const report = writeNotes(vault, [
      { path: "Verdict/Blocked/1.0.0.md", content: "x" },
      { path: "Verdict/Vite/8.0.0.md", content: "y" },
    ]);
    expect(report.failed).toMatchObject([{ path: "Verdict/Blocked/1.0.0.md" }]);
    expect(report.written).toEqual(["Verdict/Vite/8.0.0.md"]);
  });
});

import { describe, expect, it } from "vitest";
import type { SummaryContent } from "@/modules/summaries";
import { safeFileName, type VaultRelease, vaultNotes } from "./vault-note";

const SITE = "https://example.test";

const ACTION: SummaryContent = {
  title: "Middleware becomes proxy",
  actionRequired: true,
  notesJudgeable: true,
  keyPoints: [{ text: "Turbopack by default" }, { text: "React 19.2" }, { text: "Node 20.9 minimum", quote: "Node.js 20.9" }],
  breakingChanges: [{ change: "`middleware.ts` is renamed", migration: "Rename it to `proxy.ts`", quote: "rename\nmiddleware" }],
};

function release(overrides: Partial<VaultRelease> = {}): VaultRelease {
  return {
    technologyName: "Next.js",
    slug: "next",
    version: "16.0.0",
    significance: "featured",
    publishedAt: "2026-10-21T17:00:00.000Z",
    notesUrl: "https://github.com/vercel/next.js/releases/tag/v16.0.0",
    summaryStatus: "ready",
    summary: ACTION,
    ...overrides,
  };
}

const followed = new Set(["next"]);

describe("vaultNotes: which Releases get a note", () => {
  it("writes one for a followed Technology whose Summary asks for action", () => {
    expect(vaultNotes([release()], followed, "en", SITE).map((note) => note.path)).toEqual(["Verdict/Next.js/16.0.0.md"]);
  });

  it.each([
    ["not followed", release({ slug: "vite" })],
    ["no action required", release({ summary: { ...ACTION, actionRequired: false, breakingChanges: [] } })],
    ["no Summary", release({ summaryStatus: null, summary: null })],
    ["a failed Summary", release({ summaryStatus: "failed", summary: null })],
    ["a skipped Summary", release({ summaryStatus: "skipped", summary: null })],
    ["a Summary not ready yet", release({ summaryStatus: "pending", summary: ACTION })],
  ])("leaves out a Release with %s", (_, one) => {
    expect(vaultNotes([one], followed, "en", SITE)).toEqual([]);
  });
});

describe("safeFileName", () => {
  it.each([
    ["../../etc", "----etc"],
    ["a/b\\c", "a-b-c"],
    ['x<>:"|?*y', "x-------y"],
    ["..", "-"],
    ["CON", "_CON"],
    ["nul.txt", "_nul.txt"],
    ["1.0.0. ", "1.0.0"],
    ["", "_"],
  ])("neutralises %j", (raw, safe) => {
    expect(safeFileName(raw)).toBe(safe);
  });

  it("keeps a dangerous version inside its Technology's folder", () => {
    const [note] = vaultNotes([release({ technologyName: "../x", version: "../../1.0" })], followed, "en", SITE);
    expect(note?.path).toBe("Verdict/--x/----1.0.md");
  });
});

describe("the note", () => {
  const en = vaultNotes([release()], followed, "en", SITE)[0]?.content ?? "";
  const it_ = vaultNotes([release()], followed, "it", SITE)[0]?.content ?? "";
  const frontmatter = (content: string) => content.split("\n---\n")[0];

  it("has the same frontmatter in every language, with English keys", () => {
    expect(frontmatter(en)).toBe(frontmatter(it_));
    expect(frontmatter(en)).toBe(
      [
        "---",
        'technology: "Next.js"',
        'version: "16.0.0"',
        "significance: featured",
        "actionRequired: true",
        'publishedAt: "2026-10-21T17:00:00.000Z"',
        'url: "https://example.test/technologies/next/16.0.0"',
        'notesUrl: "https://github.com/vercel/next.js/releases/tag/v16.0.0"',
        "generatedBy: verdict",
      ].join("\n"),
    );
  });

  it("writes the headings in the app's language", () => {
    expect(en).toContain("## Breaking changes");
    expect(en).toContain("## Key points");
    expect(it_).toContain("## Punti chiave");
    expect(it_).toContain("Migrazione:");
  });

  it("carries the Summary as it is", () => {
    for (const text of [ACTION.title, "`middleware.ts` is renamed", "Rename it to `proxy.ts`", "Turbopack by default", "> Node.js 20.9", "> rename\n  > middleware"]) {
      expect(en).toContain(text);
    }
    expect(en.replace(/^[\s\S]*?\n---\n/, "")).toBe(it_.replace(/^[\s\S]*?\n---\n/, "").replace("Punti chiave", "Key points").replaceAll("Migrazione", "Migration"));
  });

  it("writes a missing notes URL as null", () => {
    const [note] = vaultNotes([release({ notesUrl: null })], followed, "en", SITE);
    expect(note?.content).toContain("notesUrl: null");
  });
});

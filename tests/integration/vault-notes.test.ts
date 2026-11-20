import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writePreferredLocale, writeVaultNotes } from "@/modules/notifications/server";
import { generatePendingSummaries } from "@/modules/summaries/server";
import { type Content, seedContent, testDatabase } from "./database";

const SITE = "https://example.test";

// What a model answers for a Release that breaks something: the app generates it, the vault gets it.
const OUTPUT = JSON.stringify({
  title: "The config file moved",
  actionRequired: true,
  notesJudgeable: true,
  keyPoints: [{ text: "One" }, { text: "Two" }, { text: "Three" }],
  breakingChanges: [{ change: "`a.config` is gone", migration: "Use `b.config`" }],
});

let vault: string;
let db: ReturnType<typeof testDatabase>;
let content: Content;

beforeEach(async () => {
  vault = mkdtempSync(join(tmpdir(), "verdict-vault-"));
  db = testDatabase();
  content = seedContent(db);
  await generatePendingSummaries(db, async () => ({ type: "succeeded", text: OUTPUT }), { model: "test" });
});

afterEach(() => {
  rmSync(vault, { recursive: true, force: true });
});

function slug(): string {
  return String(db.prepare("select slug from technologies where id = ?").get(content.technologyId)?.slug);
}

describe("writeVaultNotes", () => {
  it("writes the note of a generated Summary that asks for action, for a followed Technology", async () => {
    db.prepare("insert into follows (technology_id) values (?)").run(content.technologyId);
    await writePreferredLocale(db, "it");

    const report = await writeVaultNotes(db, { vaultDir: vault, siteUrl: SITE });

    const path = `Verdict/${slug()}/1.0.0.md`;
    expect(report).toEqual({ written: [path], skipped: [], failed: [] });
    const note = readFileSync(join(vault, path), "utf8");
    expect(note).toContain("actionRequired: true");
    expect(note).toContain("## Punti chiave");
    expect(note).toContain("`a.config` is gone");
  });

  it("writes nothing for a Technology nobody follows", async () => {
    expect(await writeVaultNotes(db, { vaultDir: vault, siteUrl: SITE })).toEqual({ written: [], skipped: [], failed: [] });
    expect(existsSync(join(vault, "Verdict"))).toBe(false);
  });

  it("writes nothing and says nothing without a vault", async () => {
    db.prepare("insert into follows (technology_id) values (?)").run(content.technologyId);
    const warn = vi.spyOn(console, "warn");
    expect(await writeVaultNotes(db, { vaultDir: undefined, siteUrl: SITE })).toBeNull();
    expect(readdirSync(vault)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reports a vault that does not exist instead of throwing", async () => {
    const report = await writeVaultNotes(db, { vaultDir: join(vault, "missing"), siteUrl: SITE });
    expect(report).toMatchObject({ error: expect.stringContaining("missing") });
  });
});

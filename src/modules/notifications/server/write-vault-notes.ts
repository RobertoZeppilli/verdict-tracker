import "server-only";
import { accessSync, constants, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import { sqliteJson } from "@/modules/db";
import type { Database } from "@/modules/db/server";
import { SignificanceSchema, SummaryStatusSchema } from "@/modules/releases";
import { SummaryContentSchema } from "@/modules/summaries";
import { type VaultNote, type VaultRelease, vaultNotes } from "../domain/vault-note";
import { readNotificationSettings } from "./read-notification-settings";

export type VaultReport = { written: string[]; skipped: string[]; failed: { path: string; reason: string }[] };

const RowSchema = z.array(
  z.object({
    name: z.string(),
    slug: z.string(),
    version: z.string(),
    significance: SignificanceSchema,
    published_at: z.string(),
    notes_url: z.string().nullable(),
    summary_status: SummaryStatusSchema.nullable(),
    summary_content: sqliteJson(z.unknown()).nullable(),
  }),
);

// Every note the vault is missing (#242): after each run of Summaries and at startup. The file is the
// state, so the same call serves both and needs no table. A vault that cannot be used is an error
// to print, never a reason to stop the app or the Summaries. Without a vault: null, and no file.
export async function writeVaultNotes(
  db: Database,
  { vaultDir, siteUrl }: { vaultDir: string | undefined; siteUrl: string },
): Promise<VaultReport | { error: string } | null> {
  if (vaultDir === undefined) return null;
  const unusable = checkVault(vaultDir);
  if (unusable !== null) return { error: unusable };

  const rows = RowSchema.parse(
    db
      .prepare(
        `select t.name, t.slug, r.version, coalesce(r.significance_override, r.significance) as significance,
           r.published_at, rn.url as notes_url, s.status as summary_status, s.content as summary_content
         from follows f
         join technologies t on t.id = f.technology_id
         join releases r on r.technology_id = t.id
         left join summaries s on s.release_id = r.id
         left join release_notes rn on rn.release_id = r.id
         where s.status = 'ready'`,
      )
      .all(),
  );
  const releases: VaultRelease[] = rows.map((row) => {
    // Content that does not match the schema counts as no Summary, as on the Dashboard.
    const parsed = SummaryContentSchema.safeParse(row.summary_content);
    return {
      technologyName: row.name,
      slug: row.slug,
      version: row.version,
      significance: row.significance,
      publishedAt: row.published_at,
      notesUrl: row.notes_url,
      summaryStatus: row.summary_status,
      summary: parsed.success ? parsed.data : null,
    };
  });
  const followed = new Set(rows.map((row) => row.slug));
  const { preferredLocale } = await readNotificationSettings(db);
  return writeNotes(vaultDir, vaultNotes(releases, followed, preferredLocale, siteUrl));
}

function checkVault(vaultDir: string): string | null {
  try {
    if (!statSync(vaultDir).isDirectory()) return `${vaultDir} is not a folder`;
    accessSync(vaultDir, constants.W_OK);
    return null;
  } catch (error) {
    return `${vaultDir} cannot be used: ${message(error)}`;
  }
}

// Exclusive creation: a note that exists is never overwritten, so what the Developer added stays, and
// deleting a note is how to have it written again. One file that fails does not stop the others.
export function writeNotes(vaultDir: string, notes: readonly VaultNote[]): VaultReport {
  const root = resolve(vaultDir, "Verdict");
  const report: VaultReport = { written: [], skipped: [], failed: [] };
  for (const note of notes) {
    const target = resolve(vaultDir, note.path);
    const inside = relative(root, target);
    if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
      report.failed.push({ path: note.path, reason: "outside Verdict/" });
      continue;
    }
    try {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, note.content, { flag: "wx" });
      report.written.push(note.path);
    } catch (error) {
      if (isFile(target)) report.skipped.push(note.path);
      else report.failed.push({ path: note.path, reason: message(error) });
    }
  }
  return report;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

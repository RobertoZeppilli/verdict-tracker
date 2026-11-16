import { z } from "zod";

// What is really yours in an install (issue #217): the Technologies you follow and the Version in
// use of each. Everything else in the database is a copy of public data that can be rebuilt, so this
// file is the authority and the `follows` table mirrors it.

// Written by hand too: a field with a mistyped name is dropped rather than refused, so a typo costs
// that field and not the whole file.
const StateEntrySchema = z.object({
  currentVersion: z.string().trim().min(1).optional(),
  declaredAt: z.iso.datetime({ offset: true }).optional(),
});

export const StateFileSchema = z.object({ follows: z.record(z.string().min(1), StateEntrySchema) });

export type StateEntry = z.infer<typeof StateEntrySchema>;
export type StateFile = z.infer<typeof StateFileSchema>;

export type ParsedStateFile = { ok: true; state: StateFile } | { ok: false; reason: string };

export function parseStateFile(text: string): ParsedStateFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const parsed = StateFileSchema.safeParse(json);
  return parsed.success ? { ok: true, state: parsed.data } : { ok: false, reason: z.prettifyError(parsed.error) };
}

// Sorted by slug, so a file kept in a repository changes by one line when one follow changes.
export function serializeStateFile(state: StateFile): string {
  const follows = Object.fromEntries(Object.entries(state.follows).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ follows }, null, 2)}\n`;
}

// The file written back after a change in the interface: what the database follows, plus the entries
// it cannot speak for, a slug it does not know (written by hand, or not in this Catalog yet), which
// stay as they were written.
export function mergeStateFile(
  previous: StateFile,
  followed: Readonly<Record<string, StateEntry>>,
  known: ReadonlySet<string>,
): StateFile {
  const kept = Object.entries(previous.follows).filter(([slug]) => !known.has(slug));
  return { follows: { ...Object.fromEntries(kept), ...followed } };
}

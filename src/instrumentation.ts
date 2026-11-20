// Once per server start (issue #217): the follows in `verdict.json` are the authority, so the
// database is brought to them before the first page reads it. Not during a build, which is not the
// app of whoever installed it and must not touch their data.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { defaultStateFile, getDatabase } = await import("@/modules/db/server");
  const { alignFollows } = await import("@/modules/follows/server");
  for (const warning of await alignFollows(getDatabase(), defaultStateFile())) console.warn(`verdict.json: ${warning}`);
  // The vault notes that are missing (issue #242), after the follows, which decide which notes are due.
  const { writeVault } = await import("@/lib/run-detection");
  await writeVault();
}

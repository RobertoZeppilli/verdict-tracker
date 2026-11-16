import "server-only";

import { type Database, openDatabase } from "./open-database";

// One connection per process, opened on first use: `openDatabase` runs the migrations, which is a
// startup cost and not a per-request one. Kept on `globalThis` because `next dev` reloads modules
// and would otherwise leave a connection behind at every save.
declare global {
  var verdictDatabase: Database | undefined;
}

export function getDatabase(): Database {
  globalThis.verdictDatabase ??= openDatabase();
  return globalThis.verdictDatabase;
}

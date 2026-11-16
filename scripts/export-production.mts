import { existsSync } from "node:fs";
import { z } from "zod";
import { exportRow } from "@/modules/db";
import { openDatabase } from "@/modules/db/server";

// Copies the production database into a new data file (issue #211): the Catalog, its Releases,
// their Notes and the Summaries already paid for, which nobody buys twice. Read-only on production.
// Follows, Notifications and settings stay out: this file is handed to everyone who installs.
// Usage: EXPORT_SUPABASE_URL=… EXPORT_SUPABASE_SECRET_KEY=… pnpm db:export <new file>
const env = z
  .object({
    EXPORT_SUPABASE_URL: z.url(),
    EXPORT_SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  })
  .parse(process.env);

const target = process.argv[2];
if (!target) throw new Error("Usage: pnpm db:export <new file>");
if (existsSync(target)) throw new Error(`${target} already exists: the export only writes a new file.`);

// In the order the foreign keys need.
const TABLES = ["technologies", "sources", "releases", "release_notes", "summaries"] as const;
// PostgREST's default cap is 1000 rows a request; below it, so a full page never looks like the end.
const PAGE = 500;

const ColumnInfo = z.object({ name: z.string(), pk: z.number(), hidden: z.number() });
const Rows = z.array(z.record(z.string(), z.unknown()));

async function readTable(table: string, columns: string[], key: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = new URL(`/rest/v1/${table}`, env.EXPORT_SUPABASE_URL);
    url.searchParams.set("select", columns.join(","));
    url.searchParams.set("order", `${key}.asc`);
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { apikey: env.EXPORT_SUPABASE_SECRET_KEY } });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const page = Rows.parse(await response.json());
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const db = openDatabase({ file: target });
db.exec("begin");
try {
  for (const table of TABLES) {
    // `hidden` is 2 or 3 for a generated column, which SQLite computes and refuses on insert.
    const info = z.array(ColumnInfo).parse(db.prepare(`pragma table_xinfo(${table})`).all());
    const columns = info.filter((column) => column.hidden === 0).map((column) => column.name);
    const key = info.find((column) => column.pk === 1)?.name ?? columns[0];
    const insert = db.prepare(
      `insert into ${table} (${columns.join(", ")}) values (${columns.map((c) => `:${c}`).join(", ")})`,
    );
    const rows = await readTable(table, columns, key);
    for (const row of rows) insert.run(exportRow(table, row));
    console.log(`${table}: ${rows.length}`);
  }
  db.exec("commit");
} catch (error) {
  db.exec("rollback");
  db.close();
  throw error;
}
db.close();

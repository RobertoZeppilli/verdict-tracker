// A row as PostgREST hands it back from production, turned into what the SQLite schema holds
// (issue #211): booleans are 0/1, `jsonb` is text, a `timestamptz` is ISO-8601 in UTC with a `Z`.
export type ExportValue = string | number | null;

export function exportRow(table: string, row: Record<string, unknown>): Record<string, ExportValue> {
  const out: Record<string, ExportValue> = {};
  for (const [column, value] of Object.entries(row)) {
    out[column] = exportValue(column, value);
  }
  // A Summary production was still writing is written again by the copy that opens the file.
  if (table === "summaries" && out.status === "processing") out.status = "pending";
  return out;
}

function exportValue(column: string, value: unknown): ExportValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  // Postgres writes `+00:00` and microseconds; the schema sorts these as strings, so one shape only.
  if (column.endsWith("_at")) {
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new Error(`${column}: not a timestamp: ${text}`);
    return date.toISOString();
  }
  return text;
}

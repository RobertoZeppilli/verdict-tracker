import { z } from "zod";

// What SQLite hands back where Postgres had a type of its own (issue #211): a boolean is `0` or `1`,
// and a `jsonb` column -- or a list built with `json_group_array` in place of a PostgREST embed --
// is text. Parsed here, so the row schemas of the modules still describe the value they mean.
export const sqliteBoolean = z.union([z.literal(0), z.literal(1)]).transform((value) => value === 1);

export function sqliteJson<T extends z.ZodType>(schema: T) {
  return z
    .string()
    .transform((text, context) => {
      try {
        const value: unknown = JSON.parse(text);
        return value;
      } catch {
        context.addIssue({ code: "custom", message: "not JSON" });
        return z.NEVER;
      }
    })
    .pipe(schema);
}

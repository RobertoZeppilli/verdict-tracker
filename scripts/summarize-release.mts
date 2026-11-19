import { z } from "zod";
import { getDatabase } from "@/modules/db/server";
import { locateCitation, parseSummaryOutput, prepareSummaryRequest } from "@/modules/summaries";
import { parseServerEnv } from "@/env/parse-env";
import { createSummaryWriter } from "@/modules/summaries/server";

// A single real Release through the configured model, to read a Summary with your own eyes.
// With a remote model it costs a few cents: `pnpm summary:try <slug> <version>`.
const [slug, version] = process.argv.slice(2);
if (slug === undefined || version === undefined) {
  console.error("usage: pnpm summary:try <slug> <version>");
  process.exit(1);
}

const env = parseServerEnv(process.env);
const writer = createSummaryWriter({
  url: env.VERDICT_MODEL_URL,
  model: env.VERDICT_MODEL,
  key: env.VERDICT_MODEL_KEY,
  contextTokens: env.VERDICT_MODEL_CONTEXT,
});
if (writer === null) throw new Error("VERDICT_MODEL is not set");
const data = getDatabase()
  .prepare(
    `select n.body, r.id, r.version, t.name from release_notes n
     join releases r on r.id = n.release_id
     join technologies t on t.id = r.technology_id
     where r.version = ? and t.slug = ?`,
  )
  .get(version, slug);
if (data === undefined) throw new Error(`no release notes for ${slug} ${version}`);

const RowSchema = z.object({ body: z.string(), id: z.uuid(), version: z.string(), name: z.string() });
const row = RowSchema.parse(data);
const notes = row.body;

const prepared = prepareSummaryRequest({
  releaseId: row.id,
  model: writer.model,
  technologyName: row.name,
  version: row.version,
  notes,
});
if (!prepared.ok) throw new Error(`cannot summarize: ${prepared.reason}`);


console.log(`${slug} ${version}: ${notes.length} characters of notes. Writing...`);
const result = await writer.write(prepared.request);
if (result.type !== "succeeded") throw new Error(`${result.type}: ${result.message}`);

const parsed = parseSummaryOutput(result.text);
if (!parsed.ok) {
  console.error(`invalid output: ${parsed.reason}`);
  console.error(result.text);
  process.exit(1);
}

const summary = parsed.content;
console.log(`\ntitle: ${summary.title}`);
console.log(`actionRequired: ${summary.actionRequired}`);
for (const point of summary.keyPoints) console.log(`note: ${point.text}${citationNote(point.quote)}`);
for (const change of summary.breakingChanges) {
  console.log(`breaking: ${change.change}${citationNote(change.quote)}`);
  console.log(`  help: ${change.migration}`);
}

// The same check the pages make: a quote that is not in the notes verbatim was invented.
function citationNote(quote: string | undefined): string {
  if (quote === undefined) return "  [no quote]";
  const citation = locateCitation(notes, quote);
  return citation === null ? `  [INVENTED QUOTE: ${quote}]` : `  [lines ${citation.fromLine}-${citation.toLine}]`;
}

import { z } from "zod";
import { getDatabase } from "@/modules/db/server";
import { parseServerEnv } from "@/env/parse-env";
import { createSummaryWriter, generatePendingSummaries } from "@/modules/summaries/server";

// The pending Summaries of the whole data file, for the showcase (issue #269): the Action runs it
// after `catalog:sync` and puts the file back on the Release, so a Summary is written once. With a
// remote model it costs: `pnpm summaries:pending` writes up to SUMMARY_MAX_COUNT of them.
const env = z
  .object({
    SUMMARY_MAX_COUNT: z.coerce.number().int().positive().default(100),
  })
  .parse(process.env);

const model = parseServerEnv(process.env);
const writer = createSummaryWriter({
  url: model.VERDICT_MODEL_URL,
  model: model.VERDICT_MODEL,
  key: model.VERDICT_MODEL_KEY,
  contextTokens: model.VERDICT_MODEL_CONTEXT,
});
if (writer === null) throw new Error("VERDICT_MODEL is not set");
const report = await generatePendingSummaries(getDatabase(), writer.write, {
  model: writer.model,
  maxCount: env.SUMMARY_MAX_COUNT,
});
console.log(
  `Summaries: ${report.ready.length} ready, ${report.failed.length} failed, ${report.pending.length} still pending.`,
);
for (const id of report.failed) console.error(`summary ${id} failed`);

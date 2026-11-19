import { z } from "zod";
import { getDatabase } from "@/modules/db/server";
import { createSummaryWriter, generatePendingSummaries } from "@/modules/summaries/server";

// The pending Summaries of the whole data file, for the showcase (issue #269): the Action runs it
// after `catalog:sync` and puts the file back on the Release, so a Summary is paid once. Costs:
// `pnpm summaries:pending` writes up to SUMMARY_MAX_COUNT of them.
const env = z
  .object({
    ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-"),
    SUMMARY_MAX_COUNT: z.coerce.number().int().positive().default(100),
  })
  .parse(process.env);

const writer = createSummaryWriter(env.ANTHROPIC_API_KEY);
if (writer === null) throw new Error("unreachable: the key was validated above");
const report = await generatePendingSummaries(getDatabase(), writer, { maxCount: env.SUMMARY_MAX_COUNT });
console.log(
  `Summaries: ${report.ready.length} ready, ${report.failed.length} failed, ${report.pending.length} still pending.`,
);
for (const id of report.failed) console.error(`summary ${id} failed`);

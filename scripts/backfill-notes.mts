import { parseArgs } from "node:util";
import { z } from "zod";
import { getDatabase } from "@/modules/db/server";
import { backfillNotes, createSourceAdapters } from "@/modules/detection/server";

// Issue #80, run by hand (it was `/api/jobs/notes/backfill` until #213 took the job secret away). It
// asks GitHub and the changelogs, never Anthropic, and it cannot queue a Summary, so it does not spend.
// `--apply` writes; without it the run is a dry run that reports what it would fill.
// `--technology <slug>` narrows it to one Technology, which is also how a rate-limited run is resumed.
// shortcut: a running app keeps its cached Release pages until the next Detection revalidates them.
const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, technology: { type: "string" } } });
const env = z.object({ GITHUB_TOKEN: z.string().min(1).optional() }).parse(process.env);

const report = await backfillNotes(getDatabase(), createSourceAdapters({ githubToken: env.GITHUB_TOKEN }), {
  slug: values.technology,
  apply: values.apply,
});
console.log(JSON.stringify(report, null, 2));
if (report.failed.length > 0) process.exitCode = 1;

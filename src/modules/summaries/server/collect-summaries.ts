import { z } from "zod";
import type { Database } from "@/modules/db/server";
import type { SummaryBatches, SummaryResult } from "../domain/summary-batches";
import { parseSummaryOutput } from "../domain/summary-output";
import type { SummaryScope } from "./summary-scope";

const SubmittedSchema = z.array(
  z.object({
    release_id: z.uuid(),
    batch_id: z.string(),
    version: z.string(),
    slug: z.string(),
  }),
);

// How the public pages address a Release, so the caller can revalidate them without another query.
type ChangedRelease = { slug: string; version: string };

// `pending`: put back in the queue, to be taken again by a later run.
// `changed`: every Release whose Summary was settled, whatever the outcome — each of them reads
// differently on its page now.
export type CollectReport = {
  ready: string[];
  failed: string[];
  stillProcessing: string[];
  pending: string[];
  changed: ChangedRelease[];
};

// Phase two of ADR 0007: read the results of every batch sent by an earlier run and validate them.
export async function collectSummaryBatches(
  db: Database,
  batches: SummaryBatches,
  { technologyIds }: SummaryScope = {},
): Promise<CollectReport> {
  const submitted = db
    .prepare(
      `select s.release_id, s.batch_id, r.version, t.slug from summaries s
       join releases r on r.id = s.release_id
       join technologies t on t.id = r.technology_id
       where s.status = 'processing' and s.batch_id is not null
         and (:scope is null or r.technology_id in (select value from json_each(:scope)))
       order by s.release_id`,
    )
    .all({ scope: technologyIds === undefined ? null : JSON.stringify(technologyIds) });

  const byBatch = new Map<string, string[]>();
  const pageOf = new Map<string, ChangedRelease>();
  for (const row of SubmittedSchema.parse(submitted)) {
    byBatch.set(row.batch_id, [...(byBatch.get(row.batch_id) ?? []), row.release_id]);
    pageOf.set(row.release_id, { slug: row.slug, version: row.version });
  }

  // Guarded on the batch, so a run that overlaps this one cannot settle the Summary twice.
  const update = db.prepare(
    `update summaries set status = :status, content = :content, failure_reason = :failure_reason,
       batch_id = case when :clear_batch then null else batch_id end, updated_at = :now
     where release_id = :release_id and status = 'processing' and batch_id = :batch_id`,
  );
  const report: CollectReport = { ready: [], failed: [], stillProcessing: [], pending: [], changed: [] };
  for (const [batchId, releaseIds] of byBatch) {
    const results = await batches.collect(batchId);
    if (results === null) {
      report.stillProcessing.push(...releaseIds);
      continue;
    }
    for (const releaseId of releaseIds) {
      const outcome = settle(results.get(releaseId));
      update.run({
        status: outcome.status,
        content: outcome.content === null ? null : JSON.stringify(outcome.content),
        failure_reason: outcome.failure_reason,
        clear_batch: "batch_id" in outcome ? 1 : 0,
        now: new Date().toISOString(),
        release_id: releaseId,
        batch_id: batchId,
      });
      report[outcome.status].push(releaseId);
      const page = pageOf.get(releaseId);
      if (page) report.changed.push(page);
    }
  }
  return report;
}

type Outcome =
  | { status: "ready"; content: unknown; failure_reason: null }
  | { status: "failed"; content: null; failure_reason: string }
  | { status: "pending"; content: null; failure_reason: null; batch_id: null };

function settle(result: SummaryResult | undefined): Outcome {
  if (result === undefined) return failed("missing from the batch results");
  // Not the request's fault, so it goes back in the queue instead of being spent (ADR 0007).
  if (result.type === "credit_exhausted") return { status: "pending", content: null, failure_reason: null, batch_id: null };
  if (result.type !== "succeeded") return failed(`batch request ${result.type}: ${result.message}`);
  const parsed = parseSummaryOutput(result.text);
  return parsed.ok ? { status: "ready", content: parsed.content, failure_reason: null } : failed(parsed.reason);
}

function failed(reason: string): Outcome {
  return { status: "failed", content: null, failure_reason: reason };
}

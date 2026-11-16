import { z } from "zod";
import type { Database } from "@/modules/db/server";
import { CreditExhaustedError, type SummaryBatches, type SummaryRequest } from "../domain/summary-batches";
import { PROMPT_VERSION, prepareSummaryRequest, SUMMARY_MODEL } from "../domain/summary-prompt";
import type { SummaryScope } from "./summary-scope";

const ClaimedSchema = z.array(z.object({ release_id: z.uuid() }));

const ClaimedReleaseSchema = z.object({
  id: z.uuid(),
  version: z.string(),
  name: z.string(),
  body: z.string().nullable(),
});

// `pending`: claimed but put back in the queue, to be taken again by a later run.
export type SubmitReport = { batchId: string | null; submitted: string[]; failed: string[]; pending: string[] };

// Phase one of ADR 0007: take the pending Summaries and send them in a single batch.
// The collect run, a later execution, reads the results.
export async function submitPendingSummaries(
  db: Database,
  batches: SummaryBatches,
  { maxCount = 1000, technologyIds }: { maxCount?: number } & SummaryScope = {},
): Promise<SubmitReport> {
  const ids = claimPending(db, maxCount, technologyIds);
  if (ids.length === 0) return { batchId: null, submitted: [], failed: [], pending: [] };

  const requests: SummaryRequest[] = [];
  const failed: string[] = [];
  const load = db.prepare(
    `select r.id, r.version, t.name, n.body from releases r
     join technologies t on t.id = r.technology_id
     left join release_notes n on n.release_id = r.id
     where r.id = ?`,
  );
  for (const id of ids) {
    const release = ClaimedReleaseSchema.parse(load.get(id));
    const prepared = prepareSummaryRequest({
      releaseId: release.id,
      technologyName: release.name,
      version: release.version,
      notes: release.body ?? "",
    });
    if (prepared.ok) {
      requests.push(prepared.request);
    } else {
      setStatus(db, [release.id], { status: "failed", failure_reason: prepared.reason });
      failed.push(release.id);
    }
  }
  if (requests.length === 0) return { batchId: null, submitted: [], failed, pending: [] };

  const sending = requests.map((request) => request.releaseId);
  let batchId: string;
  try {
    batchId = await batches.submit(requests);
  } catch (error) {
    // Nothing was sent: the next run takes these Summaries again.
    setStatus(db, sending, { status: "pending" });
    // An exhausted credit is a wait, not a failure, so the job reports it instead of erroring.
    if (error instanceof CreditExhaustedError) return { batchId: null, submitted: [], failed, pending: sending };
    throw error;
  }
  setStatus(db, sending, { batch_id: batchId, model: SUMMARY_MODEL, prompt_version: PROMPT_VERSION });
  return { batchId, submitted: sending, failed, pending: [] };
}

// ADR 0003: one `update ... returning` takes each pending Summary exactly once. What
// `claim_pending_summaries` fenced with `skip locked` in Postgres is fenced here by the write lock
// SQLite takes for the statement. The scope travels as a JSON list, read back with `json_each`.
function claimPending(db: Database, maxCount: number, technologyIds: string[] | undefined): string[] {
  const claimed = db
    .prepare(
      `update summaries set status = 'processing', batch_id = null, updated_at = :now
       where status = 'pending' and release_id in (
         select s.release_id from summaries s join releases r on r.id = s.release_id
         where s.status = 'pending'
           and (:scope is null or r.technology_id in (select value from json_each(:scope)))
         order by s.updated_at limit :max
       )
       returning release_id`,
    )
    .all({
      now: new Date().toISOString(),
      scope: technologyIds === undefined ? null : JSON.stringify(technologyIds),
      max: maxCount,
    });
  return ClaimedSchema.parse(claimed).map((row) => row.release_id);
}

type StatusValues = Partial<Record<"status" | "failure_reason" | "batch_id" | "model" | "prompt_version", string>>;

function setStatus(db: Database, ids: string[], values: StatusValues): void {
  // The names come from the type above, never from input: they are spliced into the statement.
  const columns = Object.keys(values);
  const update = db.prepare(
    `update summaries set ${columns.map((column) => `${column} = ?`).join(", ")}, updated_at = ?
     where status = 'processing' and release_id = ?`,
  );
  const now = new Date().toISOString();
  for (const id of ids) update.run(...Object.values(values), now, id);
}

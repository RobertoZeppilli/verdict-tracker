import { z } from "zod";
import type { Database } from "@/modules/db/server";
import { parseSummaryOutput } from "../domain/summary-output";
import { PROMPT_VERSION, prepareSummaryRequest } from "../domain/summary-prompt";
import type { SummaryResult, SummaryWriter } from "../domain/summary-writer";
import type { SummaryScope } from "./summary-scope";

const ClaimedSchema = z.array(z.object({ release_id: z.uuid() }));

const ClaimedReleaseSchema = z.object({
  id: z.uuid(),
  version: z.string(),
  slug: z.string(),
  name: z.string(),
  body: z.string().nullable(),
});

// How the public pages address a Release, so the caller can revalidate them without another query.
type ChangedRelease = { slug: string; version: string };

// `pending`: put back to wait for a later run, because the credit ran out or the API could not be
// reached. `changed`: every Release whose Summary was settled; each reads differently on its page.
export type GenerateReport = { ready: string[]; failed: string[]; pending: string[]; changed: ChangedRelease[] };

const STALE_AFTER_MS = 15 * 60 * 1000;

type Outcome = { status: "ready"; content: string } | { status: "failed"; reason: string } | { status: "pending" };

// The pending Summaries, written one by one through the Messages API (ADR 0011) while the run waits.
// shortcut: one request at a time; with many pending Releases this is minutes, and running a few
// in parallel is the upgrade if the first update of a large Catalog proves too slow.
export async function generatePendingSummaries(
  db: Database,
  write: SummaryWriter,
  { model, maxCount = 1000, technologyIds }: { model: string; maxCount?: number } & SummaryScope,
): Promise<GenerateReport> {
  const ids = claimPending(db, maxCount, technologyIds);
  const report: GenerateReport = { ready: [], failed: [], pending: [], changed: [] };
  const load = db.prepare(
    `select r.id, r.version, t.slug, t.name, n.body from releases r
     join technologies t on t.id = r.technology_id
     left join release_notes n on n.release_id = r.id
     where r.id = ?`,
  );

  for (const [index, id] of ids.entries()) {
    const release = ClaimedReleaseSchema.parse(load.get(id));
    const prepared = prepareSummaryRequest({
      releaseId: release.id,
      model,
      technologyName: release.name,
      version: release.version,
      notes: release.body ?? "",
    });
    const outcome = prepared.ok ? settle(await write(prepared.request)) : { status: "failed" as const, reason: prepared.reason };
    if (outcome.status === "pending") {
      // The next Summary would meet the same wall: everything not yet written goes back to waiting.
      const rest = ids.slice(index);
      for (const waiting of rest) save(db, waiting, outcome, model);
      report.pending.push(...rest);
      break;
    }
    save(db, id, outcome, model);
    report[outcome.status].push(id);
    report.changed.push({ slug: release.slug, version: release.version });
  }
  return report;
}

function settle(result: SummaryResult): Outcome {
  if (result.type === "credit_exhausted" || result.type === "unreachable") return { status: "pending" };
  if (result.type === "errored") return { status: "failed", reason: result.message };
  const parsed = parseSummaryOutput(result.text);
  return parsed.ok ? { status: "ready", content: JSON.stringify(parsed.content) } : { status: "failed", reason: parsed.reason };
}

// ADR 0003: one `update ... returning` takes each pending Summary exactly once, fenced by the write
// lock SQLite takes for the statement, so two runs at once never write the same Summary twice.
// The scope travels as a JSON list, read back with `json_each`.
function claimPending(db: Database, maxCount: number, technologyIds: string[] | undefined): string[] {
  // A run that died half way leaves its Summaries `processing`; one request never takes this long.
  db.prepare("update summaries set status = 'pending' where status = 'processing' and updated_at < ?").run(
    new Date(Date.now() - STALE_AFTER_MS).toISOString(),
  );
  const claimed = db
    .prepare(
      `update summaries set status = 'processing', updated_at = :now
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

function save(db: Database, releaseId: string, outcome: Outcome, model: string): void {
  db.prepare(
    `update summaries set status = :status, content = :content, failure_reason = :reason,
       model = :model, prompt_version = :prompt_version, updated_at = :now
     where release_id = :release_id and status = 'processing'`,
  ).run({
    status: outcome.status,
    content: outcome.status === "ready" ? outcome.content : null,
    reason: outcome.status === "failed" ? outcome.reason : null,
    model: outcome.status === "pending" ? null : model,
    prompt_version: outcome.status === "pending" ? null : PROMPT_VERSION,
    now: new Date().toISOString(),
    release_id: releaseId,
  });
}

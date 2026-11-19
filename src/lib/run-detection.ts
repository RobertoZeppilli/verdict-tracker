import "server-only";

import { serverEnv } from "@/env/server";
import { SHOWCASE_URL } from "@/lib/static-site";
import { getDatabase } from "@/modules/db/server";
import { isDetectionStale } from "@/modules/detection";
import { createSourceAdapters, detectReleases, readLastDetection, recordDetection } from "@/modules/detection/server";
import { deliverSlack, generateNotifications, pruneNotifications } from "@/modules/notifications/server";
import { revalidateReleasePages } from "@/modules/releases/server";
import { createSummaryWriter, generatePendingSummaries } from "@/modules/summaries/server";

// The run in flight, shared by every request of this process: the Dashboard opened in two tabs, or
// the button pressed while the opening run is still going, waits for the same run (issue #213).
declare global {
  var verdictDetection: Promise<DetectionOutcome> | undefined;
}

export type DetectionOutcome = { ran: false } | ({ ran: true } & Awaited<ReturnType<typeof runOnce>>);

// `notify` is `verdict-tracker sync --notify` (issue #218): `sent` is `slug@version` already sent by
// an earlier run, from `verdict-sync.json`.
export type Notify = { sent: string[] };

// `force` is the Refresh button; without it the run starts only when the data is stale.
export function startDetection({ force, notify }: { force: boolean; notify?: Notify }): Promise<DetectionOutcome> {
  if (globalThis.verdictDetection !== undefined) return globalThis.verdictDetection;
  if (!force && !isDetectionStale(readLastDetection(getDatabase()), new Date())) return Promise.resolve({ ran: false });

  const run = runOnce(notify)
    .then((report) => ({ ran: true as const, ...report }))
    .finally(() => {
      globalThis.verdictDetection = undefined;
    });
  globalThis.verdictDetection = run;
  return run;
}

export function isDetectionRunning(): boolean {
  return globalThis.verdictDetection !== undefined;
}

// The Detection (ADR 0003), and the Summaries of what it found in the same run (issue #212): a new
// Release has its Summary when the run ends. Without a configured model the Summaries stay `pending`
// and the pages say what is missing.
async function runOnce(notify?: Notify) {
  const db = getDatabase();
  const adapters = createSourceAdapters({ githubToken: serverEnv.GITHUB_TOKEN });
  const { detected, ...report } = await detectReleases(db, adapters);
  const writer = createSummaryWriter(modelConfig());
  const { changed, ...summaries } =
    writer === null ? { changed: [] } : await generatePendingSummaries(db, writer.write, { model: writer.model });
  // After the Summaries, since a settled Summary is when a Notification is born (ADR 0009).
  // Under `sync --notify` with no model a Summary will not come, so the Notification does not wait for
  // it (`docs/DECISIONI.md`, #218).
  const notifications = await generateNotifications(db, new Date(), { withoutSummary: notify !== undefined && writer === null });
  // The Slack channel rides the same run, after the Notifications exist: one message per Developer
  // (`docs/DECISIONI.md`), and a broken webhook is written down rather than thrown (#172).
  const slack = await deliverSlack(db, {
    siteUrl: SHOWCASE_URL,
    webhookUrl: serverEnv.VERDICT_WEBHOOK_URL,
    skip: new Set(notify?.sent),
  });
  const pruned = await pruneNotifications(db);
  // Recorded only at the end: a run that throws half way leaves the data stale, so the next opening
  // of the Dashboard tries again.
  recordDetection(db, new Date());
  // A new Release changes the Technology page and gives the Release page its own address.
  const revalidated = revalidateReleasePages([...detected, ...changed]);
  return { ...report, detected, summaries, summaryKey: writer !== null, notifications, slack, pruned, revalidated };
}

// What the Developer configured in the environment, read here so the summaries module stays free of it.
export function modelConfig() {
  return {
    url: serverEnv.VERDICT_MODEL_URL,
    model: serverEnv.VERDICT_MODEL,
    key: serverEnv.VERDICT_MODEL_KEY,
    contextTokens: serverEnv.VERDICT_MODEL_CONTEXT,
  };
}

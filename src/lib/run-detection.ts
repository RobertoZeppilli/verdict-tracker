import "server-only";

import { env } from "@/env";
import { serverEnv } from "@/env/server";
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

// `force` is the Refresh button; without it the run starts only when the data is stale.
export function startDetection({ force }: { force: boolean }): Promise<DetectionOutcome> {
  if (globalThis.verdictDetection !== undefined) return globalThis.verdictDetection;
  if (!force && !isDetectionStale(readLastDetection(getDatabase()), new Date())) return Promise.resolve({ ran: false });

  const run = runOnce()
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
// Release has its Summary when the run ends. Without an Anthropic key the Summaries stay `pending`
// and the pages say what is missing.
async function runOnce() {
  const db = getDatabase();
  const adapters = createSourceAdapters({ githubToken: serverEnv.GITHUB_TOKEN });
  const { detected, ...report } = await detectReleases(db, adapters);
  const writer = createSummaryWriter(serverEnv.ANTHROPIC_API_KEY);
  const { changed, ...summaries } = writer === null ? { changed: [] } : await generatePendingSummaries(db, writer);
  // After the Summaries, since a settled Summary is when a Notification is born (ADR 0009).
  const notifications = await generateNotifications(db);
  // The Slack channel rides the same run, after the Notifications exist: one message per Developer
  // (`docs/DECISIONI.md`), and a broken webhook is written down rather than thrown (#172).
  const slack = await deliverSlack(db, { siteUrl: env.NEXT_PUBLIC_SITE_URL });
  const pruned = await pruneNotifications(db);
  // Recorded only at the end: a run that throws half way leaves the data stale, so the next opening
  // of the Dashboard tries again.
  recordDetection(db, new Date());
  // A new Release changes the Technology page and gives the Release page its own address.
  const revalidated = revalidateReleasePages([...detected, ...changed]);
  return { ...report, detected, summaries, notifications, slack, pruned, revalidated };
}

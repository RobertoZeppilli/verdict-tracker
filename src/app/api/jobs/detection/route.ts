import { env } from "@/env";
import { serverEnv } from "@/env/server";
import { isAuthorizedJob } from "@/lib/job-auth";
import { getDatabase } from "@/modules/db/server";
import { createSourceAdapters, detectReleases } from "@/modules/detection/server";
import { deliverSlack, generateNotifications, pruneNotifications } from "@/modules/notifications/server";
import { revalidateReleasePages } from "@/modules/releases/server";
import { createSummaryWriter, generatePendingSummaries } from "@/modules/summaries/server";

// The Detection (ADR 0003), and the Summaries of what it found in the same run (issue #212): a new
// Release has its Summary when the run ends, not a day later. Without an Anthropic key the Summaries
// stay `pending` and the pages say what is missing. GET because Vercel Cron calls with GET.
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedJob(request, serverEnv.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const adapters = createSourceAdapters({ githubToken: serverEnv.GITHUB_TOKEN });
  const db = getDatabase();
  const { detected, ...report } = await detectReleases(db, adapters);
  const writer = createSummaryWriter(serverEnv.ANTHROPIC_API_KEY);
  const { changed, ...summaries } = writer === null ? { changed: [] } : await generatePendingSummaries(db, writer);
  // After the Summaries, since a settled Summary is when a Notification is born (ADR 0009).
  const notifications = await generateNotifications(db);
  // The Slack channel rides the same run, after the Notifications exist: one message per Developer
  // (`docs/DECISIONI.md`), and a broken webhook is written down rather than thrown (#172).
  const slack = await deliverSlack(db, { siteUrl: env.NEXT_PUBLIC_SITE_URL });
  const pruned = await pruneNotifications(db);
  // A new Release changes the Technology page and gives the Release page its own address.
  return Response.json({
    ...report,
    detected,
    summaries,
    notifications,
    slack,
    pruned,
    revalidated: revalidateReleasePages([...detected, ...changed]),
  });
}

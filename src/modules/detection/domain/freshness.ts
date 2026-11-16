// Six hours (issue #213, `docs/DECISIONI.md`): Releases do not land by the minute, and every run asks
// GitHub once per Technology, which without a token allows 60 requests an hour.
export const DETECTION_MAX_AGE_HOURS = 6;

export function isDetectionStale(lastFinishedAt: Date | null, now: Date): boolean {
  if (lastFinishedAt === null) return true;
  return now.getTime() - lastFinishedAt.getTime() >= DETECTION_MAX_AGE_HOURS * 3_600_000;
}

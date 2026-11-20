import type { Translator } from "@/modules/i18n";
import type { ReleaseEvent } from "./events";

// The only host a webhook may point at. Anything else is this Developer's secret posted to somebody
// else's server, so the check is here, in the Server Action and in the database (#172).
export const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/services/";

export function isSlackWebhook(url: string): boolean {
  return url.startsWith(SLACK_WEBHOOK_PREFIX) && url.length > SLACK_WEBHOOK_PREFIX.length;
}

// Discord takes the same message (issue #218), from `VERDICT_WEBHOOK_URL` and, since #244, from the
// field of `/settings` too. The channel keeps its name `slack` in the code and the database.
const DISCORD_WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

export function isDiscordWebhook(url: string): boolean {
  return url.startsWith(DISCORD_WEBHOOK_PREFIX) && url.length > DISCORD_WEBHOOK_PREFIX.length;
}

// What the field of `/settings` accepts, and the database with it (migration 0005).
export function isWebhook(url: string): boolean {
  return isSlackWebhook(url) || isDiscordWebhook(url);
}

// What a Developer reads back instead of the URL, since the URL never leaves the server again: the
// host, which says where it goes, and the last four characters, which say **which** webhook it is
// when a Slack workspace holds several. Four and not more: the tail of the path is the secret.
export function webhookHint(url: string): string {
  return `${isDiscordWebhook(url) ? "discord.com" : "hooks.slack.com"}/…${url.slice(-4)}`;
}

// One line of the message: the Technology, the Version, what the Summary says about upgrading, and
// where to read the rest. The message has to stand on its own (issue #218): it arrives with the app
// closed, so the verdict is in the line and not behind the link. The event is kept
// rather than a word, because `featured` and `notable` are the product's grammar and stay in English
// in both languages (ADR 0008).
export type SlackLine = {
  event: ReleaseEvent;
  technologyName: string;
  version: string;
  // The row's verdict as the Dashboard prints it, label and claim: `warning: action required`.
  verdict: string;
  url: string;
};

// ⚠️ One message per run and per Developer, not one per Release (`docs/DECISIONI.md`): a webhook
// holds about one message a second, and ten Releases in a run would be ten sends in a row.
// Twelve lines is where the message stops and starts counting instead: Discord refuses a message
// over 2000 characters, Slack truncates a long one, and a line runs to about 140 with its link.
export const MAX_LINES = 12;

export function slackMessage(t: Translator, lines: readonly SlackLine[]): string {
  const shown = lines.slice(0, MAX_LINES);
  const rest = lines.length - shown.length;
  const body = shown.map((line) => `${line.event === "featured_release" ? "featured" : "notable"} · ${line.technologyName} ${line.version} · ${line.verdict} · ${line.url}`);
  const head = t("notification.slack.heading", { count: lines.length });
  const tail = rest > 0 ? [t("notification.slack.more", { count: rest })] : [];
  return [head, ...body, ...tail].join("\n");
}

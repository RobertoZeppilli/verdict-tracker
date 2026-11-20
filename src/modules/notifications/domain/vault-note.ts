import { createTranslator, dictionaryFor, type Locale, type Translator } from "@/modules/i18n";
import { releasePath, type Significance, type SummaryStatus } from "@/modules/releases";
import type { SummaryContent } from "@/modules/summaries";

// A Release as the vault needs it (#242). `summary` is the parsed content, null when it did not parse.
export type VaultRelease = {
  technologyName: string;
  slug: string;
  version: string;
  significance: Significance;
  publishedAt: string;
  notesUrl: string | null;
  summaryStatus: SummaryStatus | null;
  summary: SummaryContent | null;
};

// `path` is relative to the vault, always under `Verdict/`.
export type VaultNote = { path: string; content: string };

// GLOSSARY.md, Nota nel vault: a followed Technology and a ready Summary that asks for action.
export function vaultNotes(
  releases: readonly VaultRelease[],
  followed: ReadonlySet<string>,
  locale: Locale,
  siteUrl: string,
): VaultNote[] {
  const t = createTranslator(locale, dictionaryFor(locale));
  return releases.flatMap((release) =>
    followed.has(release.slug) && release.summaryStatus === "ready" && release.summary?.actionRequired
      ? [
          {
            path: `Verdict/${safeFileName(release.technologyName)}/${safeFileName(release.version)}.md`,
            content: `${frontmatter(release, siteUrl)}\n\n${body(release.summary, t)}`,
          },
        ]
      : [],
  );
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

// One path segment that cannot leave its folder nor be refused by Windows.
export function safeFileName(raw: string): string {
  const name = raw
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/[. ]+$/, "");
  if (name === "") return "_";
  return RESERVED.test(name) ? `_${name}` : name;
}

// Keys in English in every language, so a Dataview query survives a change of language. Strings go
// through JSON, whose escapes YAML reads the same way.
function frontmatter(release: VaultRelease, siteUrl: string): string {
  return [
    "---",
    `technology: ${JSON.stringify(release.technologyName)}`,
    `version: ${JSON.stringify(release.version)}`,
    `significance: ${release.significance}`,
    "actionRequired: true",
    `publishedAt: ${JSON.stringify(release.publishedAt)}`,
    `url: ${JSON.stringify(`${siteUrl}${releasePath(release.slug, release.version)}`)}`,
    `notesUrl: ${release.notesUrl === null ? "null" : JSON.stringify(release.notesUrl)}`,
    "generatedBy: verdict",
    "---",
  ].join("\n");
}

// The Summary as it is, under headings in the app's language.
function body(summary: SummaryContent, t: Translator): string {
  const breaking = summary.breakingChanges.map(
    (item) => `- ${item.change}\n  ${t("notification.vault.migration")}: ${item.migration}${quoted(item.quote)}`,
  );
  const points = summary.keyPoints.map((item) => `- ${item.text}${quoted(item.quote)}`);
  return [
    `# ${summary.title}`,
    `## ${t("notification.vault.breaking")}`,
    breaking.join("\n"),
    `## ${t("notification.vault.keyPoints")}`,
    points.join("\n"),
  ].join("\n\n") + "\n";
}

function quoted(quote: string | undefined): string {
  return quote === undefined ? "" : `\n${quote.split("\n").map((line) => `  > ${line}`).join("\n")}`;
}

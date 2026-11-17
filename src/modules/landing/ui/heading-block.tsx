import { HelpPointer } from "@/components/help-pointer";
import { STATIC_SITE } from "@/lib/static-site";
import { type Translator } from "@/modules/i18n";
import { Filled } from "@/modules/i18n/ui";
import { releasePath } from "@/modules/releases";
import { CITATION, SPECIMEN } from "../domain/specimen";
import { EntryAction } from "./entry-action";
import { InstallCommand } from "./install-command";

// The left half of the first screen: the claim at Claim scale with nothing above it, since a label
// over an `h1` is a kicker and the Brand Mark already sits in the header. The stake under it is the
// argument in one sentence, and both of its figures are countable in the file the foot links to.
// The proof of all of it is the panel beside this, which is why the lede can stop at a promise.
// ⚠️ The translator arrives as a prop and is not read from `i18n/server` here: a module's `ui` is
// rendered by whoever has the page's language, so it is handed `t` rather than fetching one.
export function HeadingBlock({ t }: { t: Translator }) {
  return (
    <div>
      <h1 className="max-w-[20ch] font-mono text-claim text-balance">{t("landing.claim")}</h1>
      <p className="mt-5 max-w-[54ch] font-sans text-summary-title font-medium text-pretty">
        <Filled
          text={t("landing.lede", {
            name: SPECIMEN.technology.name,
            version: SPECIMEN.version,
            lines: SPECIMEN.totalLines,
            line: CITATION.line,
          })}
          nodes={{
            breaking: (
              <strong className="font-medium">
                {t("landing.breakingChanges", { count: SPECIMEN.breakingChanges })}
              </strong>
            ),
            propTypes: <code>propTypes</code>,
          }}
        />
      </p>
      <p className="mt-4 max-w-[54ch] font-sans text-body text-text-muted">{t("landing.promise")}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {STATIC_SITE ? (
          <InstallCommand copy={t("landing.install.copy")} copied={t("landing.install.copied")} />
        ) : (
          <EntryAction />
        )}
        <HelpPointer href={releasePath(SPECIMEN.technology.slug, SPECIMEN.version)}>
          {t("landing.seeVerdict", { name: SPECIMEN.technology.slug, version: SPECIMEN.version })}
        </HelpPointer>
        {/* The Dashboard without installing anything (issue #221). */}
        {STATIC_SITE && <HelpPointer href="/demo">{t("landing.seeDemo")}</HelpPointer>}
      </div>
    </div>
  );
}

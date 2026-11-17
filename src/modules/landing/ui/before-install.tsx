import { type ReactNode } from "react";
import { type Translator } from "@/modules/i18n";
import { Filled } from "@/modules/i18n/ui";
import { REPOSITORY_URL } from "@/lib/static-site";
import { Band } from "./band";

const FACTS = ["key", "data", "follows", "notify"] as const;

// The four things a reader wants to know before installing (issue #221), on the page and not in
// the README: whose key, where the data goes, how the follows travel, how to be told with the app
// closed. The paths and file names are code, the same in every language.
export function BeforeInstall({ t }: { t: Translator }) {
  const nodes: Record<string, ReactNode> = {
    home: <code>~/.verdict</code>,
    windows: <code>%LOCALAPPDATA%\verdict</code>,
    env: <code>VERDICT_DATA_DIR</code>,
    file: <code>verdict.json</code>,
  };

  return (
    <Band id="install-title" number="04" title={t("landing.install.title")} sub={t("landing.install.sub")}>
      <dl className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        {FACTS.map((fact) => (
          <div key={fact} className="border-t border-rule-strong pt-3">
            <dt className="mb-2 font-mono text-label">{t(`landing.install.${fact}.term` as const)}</dt>
            <dd className="font-sans text-body text-text-muted">
              <Filled text={t(`landing.install.${fact}.body` as const)} nodes={nodes} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 font-mono text-meta text-text-faint">
        <Filled
          text={t("landing.install.source")}
          nodes={{ repository: <a href={REPOSITORY_URL} className="text-link">{REPOSITORY_URL.replace("https://", "")}</a> }}
        />
      </p>
    </Band>
  );
}

import type { Translator } from "@/modules/i18n";
import type { SaveVault } from "../domain/saving";
import { VaultField } from "./vault-field";

export type LastWrite = { written: number; skipped: number; failed: number; finishedAt: string };

// The Obsidian zone of `/settings` (issue #244): where the notes of #242 go, and what the last write
// did. The action is handed in by the page, since it lives beside the Detection that writes the vault.
export function VaultSettings({
  path,
  fromEnv,
  last,
  save,
  t,
}: {
  path: string | null;
  fromEnv: boolean;
  last: LastWrite | null;
  save: SaveVault;
  t: Translator;
}) {
  return (
    <section aria-labelledby="vault" className="mt-8 max-w-measure border-t border-rule pt-4">
      <h2 id="vault" className="font-sans text-headline font-semibold text-text">
        {t("settings.vault.title")}
      </h2>
      <p className="mt-2 max-w-prose font-sans text-body text-text-muted">{t("settings.vault.intro")}</p>
      <VaultField path={path} fromEnv={fromEnv} save={save} />
      {last !== null && (
        <p className="mt-2 max-w-prose font-mono text-meta text-text-muted">
          {t("settings.vault.last", { ...last, when: `${last.finishedAt.slice(0, 10)} ${last.finishedAt.slice(11, 16)} UTC` })}
        </p>
      )}
      <p className="mt-2 max-w-prose font-sans text-meta text-text-faint">{t("settings.vault.closed")}</p>
    </section>
  );
}

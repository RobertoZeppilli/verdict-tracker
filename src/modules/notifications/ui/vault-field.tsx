"use client";

import { useActionState } from "react";
import { useTranslator } from "@/modules/i18n/ui";
import { SeverityLabel, VERSION_BUTTON_CLASS, VERSION_INPUT_CLASS } from "@/modules/releases/ui";
import type { SaveVault, VaultSaved } from "../domain/saving";

const FIELD_ID = "vault-dir";
const HINT_ID = "vault-dir-hint";
const FIELD = `${VERSION_INPUT_CLASS} w-full max-w-measure stacked:w-full`;

// The vault folder of `/settings` (issue #244), the same shape as the webhook field. With
// VERDICT_VAULT_DIR set the field shows the variable and is read-only: a save would change nothing.
export function VaultField({ path, fromEnv, save }: { path: string | null; fromEnv: boolean; save: SaveVault }) {
  const t = useTranslator();
  const [saved, write, saving] = useActionState<VaultSaved, FormData>(save, { status: "idle", path, error: null });

  return (
    <div className="mt-4">
      <form action={write} className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-measure">
          <label htmlFor={FIELD_ID} className="font-mono text-diagnostic text-text-muted">
            {t("settings.vault.label")}
          </label>
          <input
            id={FIELD_ID}
            name="vault"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={saved.path ?? ""}
            readOnly={fromEnv}
            aria-invalid={saved.status === "failed" ? true : undefined}
            aria-describedby={HINT_ID}
            className={`${FIELD} mt-1`}
          />
        </div>
        {!fromEnv && (
          <button
            type="submit"
            disabled={saving}
            aria-label={t("settings.vault.saveName")}
            className={VERSION_BUTTON_CLASS}
          >
            {t("settings.notifications.slack.save")}
          </button>
        )}
      </form>

      <p id={HINT_ID} className="mt-2 max-w-prose font-sans text-meta text-text-muted">
        {fromEnv
          ? t("settings.vault.env")
          : saved.path === null
            ? t("settings.vault.none")
            : t("settings.vault.current", { path: saved.path })}
      </p>

      {saved.status === "failed" && (
        <p role="alert" className="mt-2 max-w-prose font-mono text-diagnostic text-breaking">
          <SeverityLabel tone="breaking" label="error:" />{" "}
          <span className="inline-block">
            {saved.error === null ? t("settings.vault.unchanged") : t("settings.vault.invalid", { error: saved.error })}
          </span>
        </p>
      )}
    </div>
  );
}

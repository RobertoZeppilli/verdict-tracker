"use server";

import { revalidatePath } from "next/cache";
import { serverEnv } from "@/env/server";
import { defaultStateFile } from "@/modules/db/server";
import { saveVault as saveVaultPath } from "@/modules/follows/server";
import type { VaultSaved } from "@/modules/notifications";
import { checkVault } from "@/modules/notifications/server";
import { writeVault } from "./run-detection";

// The vault field of `/settings` (issue #244). The path goes to `verdict.json`, and the notes that are
// missing are written at once, so a saved vault works without a restart. Validated here, since a form
// can be posted without the page.
export async function saveVault(previous: VaultSaved, form: FormData): Promise<VaultSaved> {
  // The variable wins, so a save would change nothing that is used: the field is read-only then.
  if (serverEnv.VERDICT_VAULT_DIR !== undefined) return { ...previous, status: "failed", error: null };
  const raw = form.get("vault");
  if (typeof raw !== "string") return { ...previous, status: "failed", error: null };
  const path = raw.trim();

  // Empty is "no vault", the way back out, as for the webhook.
  if (path !== "") {
    const unusable = checkVault(path);
    if (unusable !== null) return { ...previous, status: "failed", error: unusable };
  }
  const saved = saveVaultPath(defaultStateFile(), path === "" ? null : path);
  if (!saved.ok) return { ...previous, status: "failed", error: saved.reason };
  if (path !== "") await writeVault();
  revalidatePath("/[locale]/settings", "page");
  return { status: "saved", path: path === "" ? null : path, error: null };
}

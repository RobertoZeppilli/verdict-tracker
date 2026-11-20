import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { clearVault, stateFile } from "./fixtures";

// The vault field of `/settings` (issue #244). The suite runs with VERDICT_VAULT_DIR empty
// (`playwright.config.ts`), so the field is the one that decides.
let vault: string;

test.beforeEach(() => {
  vault = mkdtempSync(join(tmpdir(), "verdict-e2e-vault-"));
});

// The path goes to `verdict.json` of `.e2e-data`: taken out again, so no later test writes a vault.
test.afterEach(() => {
  rmSync(vault, { recursive: true, force: true });
  clearVault();
});

test("a vault folder is saved, written at once and kept in verdict.json", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 2, name: "Obsidian" })).toBeVisible();

  await page.getByRole("textbox", { name: "vault folder" }).fill(vault);
  await page.getByRole("button", { name: "save the vault folder" }).click();

  await expect(page.getByText(`Writing into ${vault}.`)).toBeVisible();
  // The write ran on the save, without a restart: the line of the last write is there.
  await expect(page.getByText(/^Last written on /)).toBeVisible();
  expect(JSON.parse(readFileSync(stateFile(), "utf8"))).toMatchObject({ vault });

  await page.reload();
  await expect(page.getByRole("textbox", { name: "vault folder" })).toHaveValue(vault);
});

test("a folder that does not exist is refused beside the field", async ({ page }) => {
  await page.goto("/settings");

  await page.getByRole("textbox", { name: "vault folder" }).fill(join(vault, "missing"));
  await page.getByRole("button", { name: "save the vault folder" }).click();

  // Next keeps an empty `role="alert"` of its own, so the error is found by its text.
  await expect(page.getByRole("alert").filter({ hasText: "error:" })).toContainText("Not saved:");
  await expect(page.getByText("No vault yet")).toBeVisible();
});

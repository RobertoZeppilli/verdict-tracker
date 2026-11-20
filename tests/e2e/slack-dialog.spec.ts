import { expect, test } from "@playwright/test";

// The dialog of #199, a guide to making a webhook since #218: "Add to Slack" left with its client
// secret, so the field to paste a webhook into is the only way in, and the dialog says how to get one.
test("the guide lists the steps, links to Slack, and closes", async ({ page }) => {
  await page.goto("/settings");
  // The field is always there now: no credentials decide the layout any more.
  await expect(page.getByLabel("webhook URL")).toBeVisible();

  const open = page.getByRole("button", { name: "how to make a webhook" });
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("A webhook, step by step")).toBeVisible();
  await expect(dialog.getByRole("listitem")).toHaveCount(7);
  await expect(dialog.getByRole("link", { name: "open Slack's app page" })).toHaveAttribute(
    "href",
    "https://api.slack.com/apps",
  );

  // `Esc` closes it, which is Radix's own doing and is asserted because it is a promise of WCAG 2.2.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await open.click();
  await page.getByRole("button", { name: "close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

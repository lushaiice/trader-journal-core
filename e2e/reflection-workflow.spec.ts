import { test, expect } from "@playwright/test";

/**
 * Reflection autosave / draft-restore workflow (skeleton).
 * Requires E2E_EMAIL / E2E_PASSWORD; remove .skip to run locally.
 */
test.skip("reflection draft survives a refresh", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/);
  await page.goto("/today");

  const editor = page.getByRole("textbox").first();
  await editor.fill("A calm reflection — process over outcome.");
  // Wait past the autosave debounce
  await page.waitForTimeout(1000);

  await page.reload();
  await expect(page.getByText(/calm reflection/i)).toBeVisible();
});

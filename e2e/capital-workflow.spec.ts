import { test, expect } from "@playwright/test";

/**
 * Capital workflow (skeleton). Requires a seeded test user.
 * Set E2E_EMAIL / E2E_PASSWORD and remove .skip to run locally.
 */
test.skip("authenticated user can record capital events", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/);
  await page.goto("/capital");

  // Initial capital
  await page.getByRole("button", { name: /add capital event|add event/i }).click();
  await page.getByLabel(/amount/i).fill("100000");
  await page.getByRole("button", { name: /save/i }).click();
  await expect(page.getByText(/initial capital|net deposited/i)).toBeVisible();
});

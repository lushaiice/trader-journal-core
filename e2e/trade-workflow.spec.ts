import { test, expect } from "@playwright/test";

/**
 * Trade workflow (skeleton). Requires a seeded test user — fill in the
 * credentials via env (E2E_EMAIL / E2E_PASSWORD) before running.
 *
 * The flow asserts that an authenticated user can:
 *   1. reach the add-trade form
 *   2. submit a minimal long equity trade
 *   3. land on /trades and see the new symbol
 *
 * Marked .skip so CI does not fail without seed data; flip to .only or
 * remove the skip locally once a test account exists.
 */
test.skip("authenticated user can log a trade end-to-end", async ({ page }) => {
  const email = process.env.E2E_EMAIL!;
  const password = process.env.E2E_PASSWORD!;

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/);
  await page.goto("/add-trade");

  await page.getByLabel(/symbol/i).fill("RELIANCE");
  await page.getByLabel(/entry price/i).fill("2500");
  await page.getByLabel(/quantity/i).fill("10");

  await page.getByRole("button", { name: /save trade/i }).click();
  await page.waitForURL(/\/trades/);
  await expect(page.getByText("RELIANCE")).toBeVisible();
});

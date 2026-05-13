import { test, expect } from "@playwright/test";

/**
 * Onboarding wizard persistence. Requires a seeded test user.
 */
test.skip("onboarding wizard appears once and stays dismissed", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(/welcome to trader os/i)).toBeVisible();
  await page.getByRole("button", { name: /skip for now/i }).click();

  await page.reload();
  await expect(page.getByText(/welcome to trader os/i)).not.toBeVisible();
});

import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared auth fixture.
 *
 * Logs in once per worker via the seeded E2E user, then reuses the
 * authenticated `page` across specs. If credentials are missing the
 * fixture throws a calm, actionable message instead of a flaky redirect.
 */

export const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

export const hasE2ECredentials = Boolean(E2E_EMAIL && E2E_PASSWORD);

export async function loginViaForm(page: Page) {
  if (!hasE2ECredentials) {
    throw new Error(
      "E2E_EMAIL / E2E_PASSWORD not set — seed a test user and configure env vars.",
    );
  }
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(E2E_EMAIL);
  await page.getByLabel(/password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|today)/, { timeout: 15_000 });
}

type AuthFixtures = {
  authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    await loginViaForm(page);
    await use(page);
  },
});

export { expect };

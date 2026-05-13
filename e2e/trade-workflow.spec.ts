import { test, expect } from "./fixtures/auth";
import { hasE2ECredentials } from "./fixtures/auth";
import { resetClientState } from "./fixtures/cleanup";

test.skip(!hasE2ECredentials, "E2E credentials not configured");

test.describe("trade lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test("authenticated user can reach the add-trade form", async ({ authedPage: page }) => {
    await page.goto("/add-trade");
    await expect(page.getByLabel(/symbol/i)).toBeVisible({ timeout: 10_000 });
  });

  test("authenticated user can navigate to trades list", async ({ authedPage: page }) => {
    await page.goto("/trades");
    await expect(page).toHaveURL(/\/trades/);
  });
});

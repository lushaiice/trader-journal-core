import { test, expect } from "./fixtures/auth";
import { hasE2ECredentials } from "./fixtures/auth";

test.skip(!hasE2ECredentials, "E2E credentials not configured");

test("analytics dashboard renders for authenticated user", async ({ authedPage: page }) => {
  await page.goto("/analytics");
  await expect(page).toHaveURL(/\/analytics/);
  await expect(page.getByRole("heading", { name: /analytics/i }).first())
    .toBeVisible({ timeout: 10_000 });
});

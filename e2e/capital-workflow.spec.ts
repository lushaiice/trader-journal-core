import { test, expect } from "./fixtures/auth";
import { hasE2ECredentials } from "./fixtures/auth";

test.skip(!hasE2ECredentials, "E2E credentials not configured");

test("authenticated user can open the capital page", async ({ authedPage: page }) => {
  await page.goto("/capital");
  await expect(page).toHaveURL(/\/capital/);
  // Either the empty-state prompt or the timeline should render.
  await expect(
    page.getByText(/capital|portfolio|first capital/i).first(),
  ).toBeVisible({ timeout: 10_000 });
});

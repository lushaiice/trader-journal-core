import { test, expect } from "./fixtures/auth";
import { hasE2ECredentials } from "./fixtures/auth";
import { resetClientState } from "./fixtures/cleanup";

test.skip(!hasE2ECredentials, "E2E credentials not configured");

test("reflection page renders editable surface", async ({ authedPage: page }) => {
  await resetClientState(page);
  await page.goto("/today");
  // A textbox / textarea must be available for reflection autosave.
  await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: 10_000 });
});

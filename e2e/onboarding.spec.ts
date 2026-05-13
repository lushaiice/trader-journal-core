import { test, expect } from "./fixtures/auth";
import { hasE2ECredentials } from "./fixtures/auth";
import { resetClientState } from "./fixtures/cleanup";

test.skip(!hasE2ECredentials, "E2E credentials not configured");

test("onboarding wizard persists dismissal across reload", async ({ authedPage: page }) => {
  await resetClientState(page);
  await page.goto("/dashboard");

  const skip = page.getByRole("button", { name: /skip|dismiss|close/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }

  await page.reload();
  // Welcome heading should not reappear after dismissal.
  await expect(page.getByText(/welcome to trader os/i)).toHaveCount(0);
});

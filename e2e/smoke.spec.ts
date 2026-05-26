import { test, expect } from "@playwright/test";

/**
 * Smoke: the public surface should always render the login page calmly,
 * never a stack trace or empty body. Validates the root error boundary
 * and shell are wired before authenticated workflows are even attempted.
 */
test("login page renders without crash", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("body")).not.toBeEmpty();
  // Must not leak a React error overlay
  await expect(page.locator("text=/Unexpected Application Error/i")).toHaveCount(0);
});

test("unknown route shows calm 404, not a crash", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();
});

test("login page serves the correct document title", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle("Traders' OS — Calm trading journal & analytics");
});

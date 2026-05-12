import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for end-to-end workflow tests.
 *
 * Run locally:
 *   bun add -d @playwright/test && bunx playwright install chromium
 *   bunx playwright test
 *
 * Specs live in /e2e and exercise full user flows (trade, capital,
 * reflection, behavior, onboarding) against a running dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
});

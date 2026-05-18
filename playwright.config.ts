import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Trader OS end-to-end workflows.
 *
 * Local:  bunx playwright test
 * CI:     E2E_EMAIL / SUPABASE_SERVICE_ROLE_KEY set as repo secrets; web
 *         server starts automatically via the `webServer` block.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global.setup.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 13"],
        storageState: "playwright/.auth/user.json",
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

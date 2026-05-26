import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Auth fixture for Traders' OS E2E specs.
 *
 * Session is injected via storageState populated by e2e/global.setup.ts.
 * There is no UI login step — the authedPage fixture simply provides a
 * page that already has a valid Supabase session loaded from
 * playwright/.auth/user.json.
 *
 * Prerequisites:
 *   - E2E_EMAIL must be set (the seeded test user)
 *   - SUPABASE_SERVICE_ROLE_KEY must be set (used by global setup only)
 *   - global.setup.ts must run before any spec that uses authedPage
 */

const AUTH_STATE_PATH = path.join(process.cwd(), "playwright", ".auth", "user.json");

export const hasE2ECredentials =
  Boolean(process.env.E2E_EMAIL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  fs.existsSync(AUTH_STATE_PATH);

type AuthFixtures = {
  authedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    if (!hasE2ECredentials) {
      throw new Error(
        "E2E auth state not available. Ensure E2E_EMAIL and SUPABASE_SERVICE_ROLE_KEY are set and global setup has run.",
      );
    }
    // storageState is already applied at the project level in playwright.config.ts.
    // This fixture just provides the page under a named key for spec clarity.
    await use(page);
  },
});

export { expect };

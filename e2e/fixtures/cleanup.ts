import type { Page } from "@playwright/test";

/**
 * Deterministic per-spec cleanup. Each helper removes only rows the spec
 * itself just created, identified by a unique tag (symbol prefix, note
 * substring, etc.). We never touch the seeded test user.
 */

export const E2E_TAG = "E2E_";

export function uniqueSymbol(prefix = "E2E"): string {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}`;
}

/** Removes localStorage keys that persist onboarding/draft state. */
export async function resetClientState(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

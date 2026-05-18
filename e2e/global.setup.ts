import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

export default async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_EMAIL;
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:5173";

  if (!supabaseUrl || !serviceRoleKey || !email) {
    console.warn(
      "[global.setup] Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or E2E_EMAIL — skipping auth setup.",
    );
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: baseUrl + "/dashboard" },
  });

  if (error || !data?.properties?.action_link) {
    throw new Error(
      `[global.setup] Failed to generate magic link: ${error?.message ?? "no action_link returned"}`,
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(data.properties.action_link);
  await page.waitForURL(/\/(dashboard|today)/, { timeout: 20_000 });

  const authDir = path.join(process.cwd(), "playwright", ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: path.join(authDir, "user.json") });

  await browser.close();
}

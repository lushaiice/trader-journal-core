import { test, expect } from "./fixtures/auth";
import { hasE2ECredentials } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

test.skip(!hasE2ECredentials, "E2E credentials not configured");

/**
 * Business-correctness spec: trade with known inputs → expected Net P&L.
 *
 * Uses the Supabase admin client to seed data deterministically — no UI
 * form interaction. Tests the DB → React Query → analytics engine → UI
 * rendering path end-to-end.
 *
 * Seeded trade:
 *   RELIANCE long, 100 qty, entry 2500, exit 2550, brokerage 50
 *   Expected Net P&L = (2550 - 2500) * 100 - 50 = 4950
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const E2E_EMAIL = process.env.E2E_EMAIL!;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let seededTradeId: string | null = null;

test.beforeAll(async () => {
  const admin = adminClient();

  const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw new Error(`[trade-pnl] listUsers failed: ${listError.message}`);
  const user = users.find((u) => u.email === E2E_EMAIL);
  if (!user) throw new Error(`[trade-pnl] E2E user not found: ${E2E_EMAIL}`);
  const userId = user.id;

  await admin.from("trade_exits")
    .delete()
    .in(
      "trade_id",
      (
        await admin.from("trades")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "closed")
      ).data?.map((r: { id: string }) => r.id) ?? [],
    );
  await admin.from("trades")
    .delete()
    .eq("user_id", userId)
    .eq("status", "closed");

  const today = new Date().toISOString().slice(0, 10) + "T09:15:00.000Z";
  const { data: tradeRow, error: tradeErr } = await admin
    .from("trades")
    .insert({
      user_id: userId,
      symbol: "RELIANCE",
      instrument_type: "equity",
      side: "long",
      entry_price: 2500,
      quantity: 100,
      entry_date: today,
      brokerage: 50,
      taxes: 0,
      other_fees: 0,
      status: "closed",
      tags: [],
      notes: "E2E_PNL_CORRECTNESS_TEST",
    })
    .select("id")
    .single();
  if (tradeErr) throw new Error(`[trade-pnl] trade insert failed: ${tradeErr.message}`);
  seededTradeId = tradeRow.id;

  const { error: exitErr } = await admin.from("trade_exits").insert({
    trade_id: seededTradeId,
    user_id: userId,
    exit_price: 2550,
    quantity: 100,
    exit_date: today,
    fees: 0,
  });
  if (exitErr) throw new Error(`[trade-pnl] exit insert failed: ${exitErr.message}`);
});

test.afterAll(async () => {
  if (!seededTradeId) return;
  const admin = adminClient();
  await admin.from("trade_exits").delete().eq("trade_id", seededTradeId);
  await admin.from("trades").delete().eq("id", seededTradeId);
  seededTradeId = null;
});

test("net P&L metric reflects correct value after trade insert", async ({
  authedPage: page,
}) => {
  await page.goto("/analytics");
  await page.waitForLoadState("networkidle", { timeout: 15_000 });

  const pnlMetric = page.getByTestId("metric-net-pnl");
  await expect(pnlMetric).toBeVisible({ timeout: 15_000 });

  const rawText = await pnlMetric.textContent();
  const numeric = parseFloat((rawText ?? "").replace(/[^0-9.\-]/g, ""));
  expect(numeric).toBe(4950);
});

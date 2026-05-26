import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { TradeFormParsed } from "./schema";
import type { DisciplineRow, ExitRow, TradeRow } from "./calculations";
import { SCREENSHOT_BUCKET } from "./constants";

export interface TradeWithRelations {
  trade: TradeRow;
  exits: ExitRow[];
  discipline: DisciplineRow[];
}

export function useTradesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trades", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TradeWithRelations[]> => {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("*")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      const ids = (trades ?? []).map((t) => t.id);
      if (!ids.length) return [];
      const [{ data: exits }, { data: discipline }] = await Promise.all([
        supabase.from("trade_exits").select("*").in("trade_id", ids),
        supabase.from("discipline_logs").select("*").in("trade_id", ids),
      ]);
      return (trades ?? []).map((trade) => ({
        trade,
        exits: (exits ?? []).filter((e) => e.trade_id === trade.id),
        discipline: (discipline ?? []).filter((d) => d.trade_id === trade.id),
      }));
    },
  });
}

export function useTradeQuery(tradeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trade", tradeId, user?.id],
    enabled: !!tradeId && !!user,
    queryFn: async (): Promise<TradeWithRelations | null> => {
      if (!tradeId) return null;
      const [{ data: trade, error }, { data: exits }, { data: discipline }] = await Promise.all([
        supabase.from("trades").select("*").eq("id", tradeId).maybeSingle(),
        supabase.from("trade_exits").select("*").eq("trade_id", tradeId),
        supabase.from("discipline_logs").select("*").eq("trade_id", tradeId),
      ]);
      if (error) throw error;
      if (!trade) return null;
      return { trade, exits: exits ?? [], discipline: discipline ?? [] };
    },
  });
}

async function persistTrade(values: TradeFormParsed, userId: string, tradeId?: string) {
  const exitsTotal = values.exits.reduce((a, e) => a + Number(e.quantity), 0);
  const status: TradeRow["status"] =
    exitsTotal <= 0 ? "open" : exitsTotal >= Number(values.quantity) ? "closed" : "partial";

  const tradePayload = {
    user_id: userId,
    symbol: values.symbol,
    instrument_type: values.instrument_type,
    side: values.side,
    entry_date: values.entry_date,
    entry_price: values.entry_price,
    quantity: values.quantity,
    planned_entry: values.planned_entry,
    planned_stop_loss: values.planned_stop_loss,
    planned_target: values.planned_target,
    brokerage: values.brokerage,
    taxes: values.taxes,
    other_fees: values.other_fees,
    confidence: values.confidence,
    emotion_level: values.emotion_level,
    recovery_urge: values.recovery_urge,
    discipline_feel: values.discipline_feel,
    setup_match: values.setup_match,
    tags: values.tags,
    notes: values.notes || null,
    screenshot_url: values.screenshot_url || null,
    status,
  };

  let savedTradeId = tradeId;
  if (tradeId) {
    const { error } = await supabase.from("trades").update(tradePayload).eq("id", tradeId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("trades")
      .insert(tradePayload)
      .select("id")
      .single();
    if (error) throw error;
    savedTradeId = data.id;
  }

  if (!savedTradeId) throw new Error("Trade save failed");

  // Replace exits & discipline (simple, reliable)
  await supabase.from("trade_exits").delete().eq("trade_id", savedTradeId);
  if (values.exits.length) {
    const { error } = await supabase.from("trade_exits").insert(
      values.exits.map((e) => ({
        trade_id: savedTradeId!,
        user_id: userId,
        exit_price: e.exit_price,
        quantity: e.quantity,
        exit_date: e.exit_date,
        notes: e.notes || null,
      })),
    );
    if (error) throw error;
  }

  await supabase.from("discipline_logs").delete().eq("trade_id", savedTradeId);
  if (values.discipline.length) {
    const { error } = await supabase.from("discipline_logs").insert(
      values.discipline.map((d) => ({
        trade_id: savedTradeId!,
        user_id: userId,
        rule: d.rule,
        followed: d.followed,
        log_date: values.entry_date.slice(0, 10),
      })),
    );
    if (error) throw error;
  }

  return savedTradeId;
}

export function useSaveTrade(tradeId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: TradeFormParsed) => {
      if (!user) throw new Error("Not signed in");
      return persistTrade(values, user.id, tradeId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["trade"] });
    },
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tradeId: string) => {
      // exits/discipline cascade via FK on discipline; trade_exits via parent delete? we stored FK on exits
      await supabase.from("trade_exits").delete().eq("trade_id", tradeId);
      await supabase.from("discipline_logs").delete().eq("trade_id", tradeId);
      const { error } = await supabase.from("trades").delete().eq("id", tradeId);
      if (error) throw error;
    },
    onMutate: async (tradeId) => {
      await qc.cancelQueries({ queryKey: ["trades"] });
      const previous = qc.getQueryData<TradeWithRelations[]>(["trades"]);
      qc.setQueriesData<TradeWithRelations[]>({ queryKey: ["trades"] }, (old) =>
        (old ?? []).filter((t) => t.trade.id !== tradeId),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["trades"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  });
}

export async function uploadScreenshot(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  // Bucket is private — store the storage path; reads use short-lived signed URLs.
  return path;
}

/** Extract the in-bucket object path from either a stored path or a legacy public/signed URL. */
export function getScreenshotPath(stored: string): string {
  const marker = `/${SCREENSHOT_BUCKET}/`;
  const idx = stored.indexOf(marker);
  if (idx === -1) return stored.replace(/^\/+/, "");
  return stored.slice(idx + marker.length).split("?")[0];
}

/** Create a short-lived signed URL for a stored screenshot reference. */
export async function getScreenshotSignedUrl(
  stored: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = getScreenshotPath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function removeScreenshot(stored: string) {
  const path = getScreenshotPath(stored);
  if (!path) return;
  await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
}

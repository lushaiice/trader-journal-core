import { supabase } from "@/integrations/supabase/client";
import type { OpeningPosition, CorporateAction } from "./types";

export interface OpeningPositionRow extends OpeningPosition {
  id: string;
  notes: string | null;
}

export interface CorporateActionRow extends CorporateAction {
  id: string;
  notes: string | null;
}

export async function loadOpeningPositions(
  userId: string,
): Promise<OpeningPositionRow[]> {
  const { data, error } = await supabase
    .from("opening_positions")
    .select("id,symbol,side,quantity,avg_cost,acquisition_date,notes")
    .eq("user_id", userId)
    .order("symbol");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    symbol: r.symbol,
    side: r.side as "long" | "short",
    quantity: Number(r.quantity),
    avgCost: Number(r.avg_cost),
    acquisitionDate: r.acquisition_date,
    notes: r.notes,
  }));
}

export async function upsertOpeningPosition(
  userId: string,
  input: OpeningPosition & { notes?: string | null; id?: string },
): Promise<void> {
  const row = {
    user_id: userId,
    symbol: input.symbol.trim().toUpperCase(),
    side: input.side,
    quantity: input.quantity,
    avg_cost: input.avgCost,
    acquisition_date: input.acquisitionDate,
    notes: input.notes ?? null,
  };
  if (input.id) {
    const { error } = await supabase
      .from("opening_positions")
      .update(row)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("opening_positions")
      .upsert(row, { onConflict: "user_id,symbol" });
    if (error) throw error;
  }
}

export async function deleteOpeningPosition(id: string): Promise<void> {
  const { error } = await supabase.from("opening_positions").delete().eq("id", id);
  if (error) throw error;
}

export async function loadCorporateActions(
  userId: string,
): Promise<CorporateActionRow[]> {
  const { data, error } = await supabase
    .from("corporate_actions")
    .select("id,symbol,ex_date,action_type,ratio_from,ratio_to,notes")
    .eq("user_id", userId)
    .order("symbol")
    .order("ex_date");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    symbol: r.symbol,
    exDate: r.ex_date,
    actionType: r.action_type as CorporateAction["actionType"],
    ratioFrom: Number(r.ratio_from),
    ratioTo: Number(r.ratio_to),
    notes: r.notes,
  }));
}

export async function upsertCorporateAction(
  userId: string,
  input: CorporateAction & { notes?: string | null; id?: string },
): Promise<void> {
  const row = {
    user_id: userId,
    symbol: input.symbol.trim().toUpperCase(),
    ex_date: input.exDate,
    action_type: input.actionType,
    ratio_from: input.ratioFrom,
    ratio_to: input.ratioTo,
    notes: input.notes ?? null,
  };
  if (input.id) {
    const { error } = await supabase
      .from("corporate_actions")
      .update(row)
      .eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("corporate_actions").insert(row);
    if (error) throw error;
  }
}

export async function deleteCorporateAction(id: string): Promise<void> {
  const { error } = await supabase.from("corporate_actions").delete().eq("id", id);
  if (error) throw error;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { CorporateAction, HoldingBaseline } from "./corporate-actions";

/** Stored corporate action → in-app CorporateAction (factor = ratio_to / ratio_from). */
export function useCorporateActions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["corporate_actions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CorporateAction[]> => {
      const { data, error } = await supabase
        .from("corporate_actions")
        .select("isin, symbol, action_type, ex_date, ratio_from, ratio_to");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        isin: r.isin,
        symbol: r.symbol,
        action_type: r.action_type as "split" | "bonus" | "consolidation",
        ex_date: r.ex_date,
        ratio: Number(r.ratio_to) / Number(r.ratio_from),
      }));
    },
  });
}

export function useHoldingBaselines() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["holding_baselines", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<HoldingBaseline[]> => {
      const { data, error } = await supabase
        .from("opening_positions")
        .select("isin, symbol, avg_cost, acquisition_date");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        isin: r.isin,
        symbol: r.symbol,
        avg_cost: Number(r.avg_cost),
        as_of_date: r.acquisition_date ?? null,
      }));
    },
  });
}

export interface AddCorporateActionInput {
  isin: string | null;
  symbol: string;
  action_type: "split" | "bonus" | "consolidation";
  ex_date: string;
  /** Numerator + denominator used by the UI: split N/M, bonus (N+M)/M, consolidation N/M. */
  ratio_from: number;
  ratio_to: number;
}

export function useAddCorporateAction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: AddCorporateActionInput) => {
      if (!user) throw new Error("Not signed in");
      // Manual upsert: unique key is functional (coalesce(isin, symbol)) so
      // postgrest onConflict can't target it. Delete any matching row first.
      const symbolUC = input.symbol.toUpperCase();
      let del = supabase
        .from("corporate_actions")
        .delete()
        .eq("user_id", user.id)
        .eq("ex_date", input.ex_date);
      del = input.isin
        ? del.eq("isin", input.isin)
        : del.is("isin", null).eq("symbol", symbolUC);
      const delRes = await del;
      if (delRes.error) throw delRes.error;
      const { error } = await supabase.from("corporate_actions").insert({
        user_id: user.id,
        isin: input.isin,
        symbol: symbolUC,
        action_type: input.action_type,
        ex_date: input.ex_date,
        ratio_from: input.ratio_from,
        ratio_to: input.ratio_to,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corporate_actions", user?.id] });
    },
  });
}

export interface AddHoldingBaselineInput {
  isin: string | null;
  symbol: string;
  avg_cost: number;
  quantity: number;
  as_of_date: string | null;
}

export function useAddHoldingBaseline() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: AddHoldingBaselineInput) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("opening_positions").upsert(
        {
          user_id: user.id,
          isin: input.isin,
          symbol: input.symbol.toUpperCase(),
          avg_cost: input.avg_cost,
          quantity: input.quantity,
          side: "long",
          acquisition_date: input.as_of_date ?? new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,isin,symbol" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holding_baselines", user?.id] });
    },
  });
}

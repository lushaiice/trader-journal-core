import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import type { PlaybookFormParsed } from "./schema";

export type PlaybookRow = Database["public"]["Tables"]["playbooks"]["Row"];

export interface PlaybookWithUsage extends PlaybookRow {
  trade_count: number;
}

export function usePlaybooks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["playbooks", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PlaybookWithUsage[]> => {
      const [{ data: playbooks, error }, { data: trades }] = await Promise.all([
        supabase.from("playbooks").select("*").order("name", { ascending: true }),
        supabase.from("trades").select("playbook_id").not("playbook_id", "is", null),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const t of trades ?? []) {
        if (t.playbook_id) counts.set(t.playbook_id, (counts.get(t.playbook_id) ?? 0) + 1);
      }
      return (playbooks ?? []).map((p) => ({ ...p, trade_count: counts.get(p.id) ?? 0 }));
    },
  });
}

export interface UpsertPlaybookInput {
  id?: string;
  values: PlaybookFormParsed;
}

export function useUpsertPlaybook() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: UpsertPlaybookInput) => {
      if (!user) throw new Error("Not signed in");
      const payload = {
        user_id: user.id,
        name: values.name,
        description: values.description,
      };
      if (id) {
        const { error } = await supabase.from("playbooks").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("playbooks")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
    },
  });
}

export function useDeletePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("playbooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      // Trades have their playbook_id cleared by the DB; refresh those views too.
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["trade"] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface UserSettings {
  risk_free_rate: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = { risk_free_rate: 6.5 };

export function useUserSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_settings", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("risk_free_rate")
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_USER_SETTINGS;
      return { risk_free_rate: Number(data.risk_free_rate) };
    },
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<UserSettings>): Promise<UserSettings> => {
      if (!user) throw new Error("Not signed in");
      const payload = {
        user_id: user.id,
        risk_free_rate: input.risk_free_rate ?? DEFAULT_USER_SETTINGS.risk_free_rate,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select("risk_free_rate")
        .single();
      if (error) throw error;
      return { risk_free_rate: Number(data.risk_free_rate) };
    },
    onSuccess: (data) => {
      qc.setQueryData(["user_settings", user?.id], data);
    },
  });
}

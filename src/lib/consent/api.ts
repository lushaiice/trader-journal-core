import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";

export type ConsentRow =
  Database["public"]["Tables"]["communication_consent"]["Row"];

export interface ConsentInput {
  decision: "accepted" | "declined";
  email_opt_in: boolean;
  sms_opt_in: boolean;
  phone_number: string | null;
}

/**
 * Normalize an Indian mobile number. Accepts 10 digits or +91 / 91 prefix.
 * Returns E.164 (+91XXXXXXXXXX) or null when the input is empty/invalid.
 */
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits[2]))
    return `+${digits}`;
  return null;
}

export function useConsentStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["communication_consent", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ConsentRow | null> => {
      const { data, error } = await supabase
        .from("communication_consent")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveConsentMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: ConsentInput): Promise<ConsentRow> => {
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("communication_consent")
        .upsert(
          {
            user_id: user.id,
            decision: input.decision,
            email_opt_in: input.email_opt_in,
            sms_opt_in: input.sms_opt_in,
            phone_number: input.phone_number,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["communication_consent", user?.id], data);
    },
  });
}

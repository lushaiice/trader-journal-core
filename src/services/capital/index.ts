/**
 * Capital service — Supabase persistence for capital_events.
 * UI must go through this layer; never query the table directly.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CapitalEvent,
  CapitalEventInput,
} from "@/types/capital";

type Row = {
  id: string;
  user_id: string;
  event_type: "initial" | "deposit" | "withdrawal";
  amount: number | string;
  event_date: string;
  notes: string | null;
  created_at: string;
};

function toDomain(row: Row): CapitalEvent {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    amount: Number(row.amount) || 0,
    eventDate: row.event_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function fetchCapitalEvents(): Promise<CapitalEvent[]> {
  const { data, error } = await supabase
    .from("capital_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toDomain(row as Row));
}

export async function createCapitalEvent(
  userId: string,
  input: CapitalEventInput,
): Promise<CapitalEvent> {
  const { data, error } = await supabase
    .from("capital_events")
    .insert({
      user_id: userId,
      event_type: input.eventType,
      amount: input.amount,
      event_date: input.eventDate,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDomain(data as Row);
}

export async function updateCapitalEvent(
  id: string,
  input: CapitalEventInput,
): Promise<CapitalEvent> {
  const { data, error } = await supabase
    .from("capital_events")
    .update({
      event_type: input.eventType,
      amount: input.amount,
      event_date: input.eventDate,
      notes: input.notes ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toDomain(data as Row);
}

export async function deleteCapitalEvent(id: string): Promise<void> {
  const { error } = await supabase.from("capital_events").delete().eq("id", id);
  if (error) throw error;
}

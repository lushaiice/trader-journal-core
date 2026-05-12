/** React Query hooks for capital events. */
import { useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  buildCapitalLedger,
  summarizeCapital,
} from "@/lib/capital";
import {
  createCapitalEvent,
  deleteCapitalEvent,
  fetchCapitalEvents,
  updateCapitalEvent,
} from "@/services/capital";
import type {
  CapitalEvent,
  CapitalEventInput,
  CapitalLedgerPoint,
  CapitalSummary,
} from "@/types/capital";

const KEY = ["capital_events"] as const;

export function useCapitalEvents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, user?.id],
    enabled: !!user,
    queryFn: fetchCapitalEvents,
  });
}

export interface CapitalState {
  isLoading: boolean;
  events: CapitalEvent[];
  ledger: CapitalLedgerPoint[];
  summary: CapitalSummary;
  /** Net deposited capital today — equity baseline for analytics. */
  baseCapital: number;
  hasInitialCapital: boolean;
}

export function useCapitalState(): CapitalState {
  const { data, isLoading } = useCapitalEvents();
  return useMemo(() => {
    const events = data ?? [];
    const ledger = buildCapitalLedger(events);
    const summary = summarizeCapital(events);
    const baseCapital = ledger.length ? ledger[ledger.length - 1].runningCapital : 0;
    return {
      isLoading,
      events,
      ledger,
      summary,
      baseCapital,
      hasInitialCapital: events.some((e) => e.eventType === "initial"),
    };
  }, [data, isLoading]);
}

export function useCreateCapitalEvent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CapitalEventInput) => {
      if (!user) throw new Error("Not signed in");
      return createCapitalEvent(user.id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateCapitalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CapitalEventInput }) =>
      updateCapitalEvent(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteCapitalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteCapitalEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

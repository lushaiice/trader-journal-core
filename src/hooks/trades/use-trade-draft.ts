import { useEffect, useRef } from "react";
import { useWatch, type Control } from "react-hook-form";
import type { TradeFormValues } from "@/lib/trades/schema";

const DRAFT_KEY = "trader-os:trade-draft:v1";
const DEBOUNCE_MS = 600;

export function loadTradeDraft(): TradeFormValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as TradeFormValues) : null;
  } catch {
    return null;
  }
}

export function clearTradeDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Autosaves the in-progress trade form to localStorage. */
export function useTradeDraftAutosave(
  enabled: boolean,
  control: Control<TradeFormValues>,
) {
  const values = useWatch({ control });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } catch {
        /* quota or serialization issue — skip */
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [values, enabled]);
}

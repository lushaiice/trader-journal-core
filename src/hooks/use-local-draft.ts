import { useEffect, useRef, useState } from "react";

/**
 * Local-first autosave hook for any serialisable form value.
 *
 * - Writes a debounced snapshot to localStorage so a refresh, crash
 *   or mobile keyboard kill doesn't lose the user's words.
 * - Restores the saved draft on mount when no remote value exists yet.
 * - Exposes `clear()` for callers to wipe the draft after a successful save.
 */
export function useLocalDraft<T>(
  key: string,
  value: T,
  enabled: boolean = true,
  debounceMs: number = 600,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota or serialisation issue — skip */
      }
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, enabled, debounceMs]);

  const load = (): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  return { load, clear };
}

/** Read a draft once (e.g. on mount) without subscribing. */
export function readLocalDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ─────────────────── Online status ─────────────────── */

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ─────────────────── Save status ─────────────────── */

export type SaveState = "idle" | "saving" | "saved" | "error";

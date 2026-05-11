/** Lightweight, local-only workspace preferences. */
import { useEffect, useState } from "react";

export interface WorkspacePreferences {
  defaultReflectionVisible: boolean;
  trackEmotional: boolean;
  trackDiscipline: boolean;
  preferredFlow: "checklist-first" | "journal-first" | "free";
  timezone: string;
}

const KEY = "trader-os:workspace-prefs:v1";

export const DEFAULT_PREFS: WorkspacePreferences = {
  defaultReflectionVisible: true,
  trackEmotional: true,
  trackDiscipline: true,
  preferredFlow: "checklist-first",
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
      : "Asia/Kolkata",
};

export function loadPreferences(): WorkspacePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<WorkspacePreferences>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: WorkspacePreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function useWorkspacePreferences() {
  const [prefs, setPrefs] = useState<WorkspacePreferences>(DEFAULT_PREFS);
  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);
  const update = (patch: Partial<WorkspacePreferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      savePreferences(next);
      return next;
    });
  };
  return { prefs, update };
}

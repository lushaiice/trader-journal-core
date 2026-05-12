import { useState, useEffect } from "react";
import { Lightbulb, X } from "lucide-react";

interface Props {
  /** Stable id used to remember dismissal in localStorage. */
  id: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Subtle, dismissible hint surface. Calm tone, never motivational.
 * Persists dismissal locally so guidance stays out of the way once seen.
 */
export function ContextualHint({ id, children, icon: Icon = Lightbulb }: Props) {
  const key = `hint:${id}:dismissed`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(window.localStorage.getItem(key) !== "1");
  }, [key]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="surface-card flex items-start gap-3 px-3.5 py-2.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
      <div className="flex-1 leading-relaxed">{children}</div>
      <button
        type="button"
        aria-label="Dismiss hint"
        onClick={dismiss}
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

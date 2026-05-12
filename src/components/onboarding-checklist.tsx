import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  id: string;
  title: string;
  hint: string;
  to: string;
  done: boolean;
}

interface Props {
  hasCapital: boolean;
  hasTrades: boolean;
  hasReflection: boolean;
  hasChecklist: boolean;
}

const DISMISS_KEY = "trader-os.onboarding.dismissed";

/**
 * Calm, dismissible first-week orientation. Replaces tutorials and modals
 * with a single inline checklist of the five core behaviors.
 */
export function OnboardingChecklist({
  hasCapital,
  hasTrades,
  hasReflection,
  hasChecklist,
}: Props) {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const steps: Step[] = [
    { id: "capital", title: "Set your starting capital", hint: "Anchors all return calculations.", to: "/capital", done: hasCapital },
    { id: "checklist", title: "Run a pre-market checklist", hint: "Builds readiness as a habit.", to: "/today", done: hasChecklist },
    { id: "trade", title: "Log your first trade", hint: "Process matters more than outcome.", to: "/add-trade", done: hasTrades },
    { id: "reflect", title: "Write a daily reflection", hint: "Reflection reveals emotional patterns.", to: "/today", done: hasReflection },
    { id: "review", title: "Review your week", hint: "Consistency compounds quietly.", to: "/weekly-review", done: false },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  if (dismissed || completed === total) return null;

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") window.localStorage.setItem(DISMISS_KEY, "1");
  };

  return (
    <section className="surface-card p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Getting started · {completed}/{total}
          </p>
          <h2 className="text-base font-semibold mt-1">Your first week with Trader OS</h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
            A short, calm sequence to settle into the daily rhythm. Take it at your own pace.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40 transition-colors"
          >
            <div
              className={
                "h-5 w-5 rounded-full flex items-center justify-center shrink-0 " +
                (s.done ? "bg-primary/15 text-primary" : "border border-border")
              }
            >
              {s.done ? <Check className="h-3 w-3" /> : null}
            </div>
            <div className="flex-1 min-w-0">
              <p className={"text-sm " + (s.done ? "text-muted-foreground line-through" : "")}>
                {s.title}
              </p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
            {!s.done && (
              <Button asChild size="sm" variant="ghost" className="shrink-0">
                <Link to={s.to}>
                  Open <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

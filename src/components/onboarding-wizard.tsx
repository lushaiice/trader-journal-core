import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "trader-os.onboarding.wizard.v1";

interface Step {
  title: string;
  body: string;
  cta?: { label: string; to: string };
}

const STEPS: Step[] = [
  {
    title: "Welcome to Traders' OS",
    body:
      "A behavioral operating system for traders. The work here is reflection, discipline, and emotional awareness — not predictions or motivation.",
  },
  {
    title: "Anchor your starting capital",
    body:
      "Capital is the baseline for every return calculation. Setting it once makes your analytics honest and capital-aware.",
    cta: { label: "Set capital", to: "/capital" },
  },
  {
    title: "Log your first closed trade",
    body:
      "Capture entry, exits, fees, and how you felt. Process matters more than outcome — partial exits and emotional tags are part of the record.",
    cta: { label: "Log a trade", to: "/add-trade" },
  },
  {
    title: "Daily reflection is the practice",
    body:
      "A short reflection each session reveals patterns the P&L can't show — emotional drift, rule slips, recovery urges.",
    cta: { label: "Open today", to: "/today" },
  },
  {
    title: "Review the week, not the trade",
    body:
      "Weekly reviews surface what your daily mind misses. Consistency compounds quietly — patterns over outcomes.",
    cta: { label: "Try a weekly review", to: "/weekly-review" },
  },
];

/**
 * Calm, skippable first-launch wizard. Five lightweight steps that
 * introduce the behavioral workflow without dopamine, gamification,
 * or product-tour overlays. Persists dismissal in localStorage.
 */
export function OnboardingWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Defer slightly so the app can mount calmly first.
      const t = window.setTimeout(() => setOpen(true), 600);
      return () => window.clearTimeout(t);
    }
  }, []);

  const dismiss = (completed: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        STORAGE_KEY,
        completed ? "completed" : "skipped",
      );
    }
    setOpen(false);
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss(false)}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => dismiss(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-6 pt-4 pb-6 space-y-3">
          <DialogTitle className="text-lg font-medium tracking-tight">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {current.body}
          </DialogDescription>
        </div>

        <div className="border-t border-border bg-muted/30 px-6 py-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dismiss(false)}
            className="text-muted-foreground"
          >
            Skip for now
          </Button>
          <div className="flex items-center gap-2">
            {current.cta && (
              <Button
                asChild
                variant="outline"
                size="sm"
                onClick={() => dismiss(true)}
              >
                <Link to={current.cta.to}>{current.cta.label}</Link>
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={() => dismiss(true)}>
                Begin
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

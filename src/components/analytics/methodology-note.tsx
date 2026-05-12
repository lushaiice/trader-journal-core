import { Info } from "lucide-react";

/**
 * Subtle methodology footnote — used to ground analytics in transparent
 * calculation assumptions. Calm, analytical tone.
 */
export function MethodologyNote({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="surface-card px-4 py-3 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/70 shrink-0" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-medium text-foreground/80">How we calculate this</p>
          <ul className="space-y-0.5 list-disc list-inside marker:text-muted-foreground/50">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_METHODOLOGY = [
  "Returns exclude deposits and withdrawals — only realized trading P&L.",
  "Drawdown is measured against capital-adjusted equity peaks.",
  "Discipline scores are behavior-weighted, not outcome-weighted.",
  "Streaks reflect consistency of journaling and reflection, not profit.",
];

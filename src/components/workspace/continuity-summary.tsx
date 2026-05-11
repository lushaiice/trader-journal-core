import { cn } from "@/lib/utils";

interface Props {
  observations: string[];
  className?: string;
}

/**
 * Habit memory surface — deterministic, analytics-derived observations.
 * Calm, reflective tone; never gamified.
 */
export function ContinuitySummary({ observations, className }: Props) {
  if (!observations.length) return null;
  return (
    <div className={cn("surface-card p-5 md:p-6", className)}>
      <h3 className="font-medium mb-3">Quiet observations</h3>
      <ul className="space-y-2">
        {observations.map((o) => (
          <li
            key={o}
            className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 py-0.5"
          >
            {o}
          </li>
        ))}
      </ul>
    </div>
  );
}

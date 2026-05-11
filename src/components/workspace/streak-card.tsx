import { Flame } from "lucide-react";
import type { StreakSummary } from "@/lib/behavior";
import { streakLabel } from "@/lib/behavior";
import { cn } from "@/lib/utils";

interface Props {
  reflection: StreakSummary;
  checklist: StreakSummary;
  journal: StreakSummary;
}

export function StreakCard({ reflection, checklist, journal }: Props) {
  const items = [
    { label: "Reflection", summary: reflection, kind: "reflection" },
    { label: "Checklist", summary: checklist, kind: "checklist" },
    { label: "Journal", summary: journal, kind: "journaling" },
  ];

  return (
    <div className="surface-card p-5 md:p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">Continuity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quiet streaks. No badges, no noise.
          </p>
        </div>
        <Flame className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>

      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{it.label}</span>
              <span className="tabular-nums text-foreground/90">
                {it.summary.current}d
                <span className="text-muted-foreground/70 text-xs ml-1.5">
                  · best {it.summary.longest}d
                </span>
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full",
                    i < it.summary.last7 ? "bg-primary/60" : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {streakLabel(it.summary.current, it.kind)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

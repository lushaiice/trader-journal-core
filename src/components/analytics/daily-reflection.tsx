import { Link } from "@tanstack/react-router";
import { NotebookPen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isToday } from "date-fns";
import type { NormalizedTrade } from "@/types/analytics";

interface Props {
  trades: NormalizedTrade[];
  disciplineToday: number | null;
}

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function DailyReflection({ trades, disciplineToday }: Props) {
  const today = trades.filter((t) => isToday(t.entryDate));
  const emotion = avg(today.map((t) => t.emotionLevel));
  const confidence = avg(today.map((t) => t.confidence));

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">Today's reflection</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Trades" value={today.length ? String(today.length) : "—"} />
        <Stat
          label="Mood"
          value={emotion != null ? emotion.toFixed(1) : "—"}
          hint="of 5"
        />
        <Stat
          label="Discipline"
          value={disciplineToday != null ? `${disciplineToday}%` : "—"}
        />
      </div>

      {today.length === 0 ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          No trades today. A quiet day is also a decision worth journaling.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          You logged {today.length} trade{today.length === 1 ? "" : "s"} today
          {confidence != null ? ` with avg confidence ${confidence.toFixed(1)}/5` : ""}.
          Take a moment to reflect.
        </p>
      )}

      <Button asChild size="sm" variant="secondary" className="w-full">
        <Link to="/today">
          <NotebookPen className="h-3.5 w-3.5 mr-2" /> Open journal
        </Link>
      </Button>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2 py-3">
      <p className="text-lg font-semibold tabular-nums">
        {value}
        {hint && <span className="text-[10px] text-muted-foreground font-normal ml-0.5">{hint}</span>}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

import type { ProcessQualityBreakdown } from "@/lib/workspace/process-quality";
import { processTone } from "@/lib/workspace/process-quality";
import { cn } from "@/lib/utils";

interface Props {
  score: ProcessQualityBreakdown;
}

const LABELS: Record<keyof Omit<ProcessQualityBreakdown, "total">, string> = {
  checklist: "Checklist",
  discipline: "Discipline",
  emotional: "Emotional",
  journaling: "Journaling",
  consistency: "Consistency",
};

export function ProcessQualityCard({ score }: Props) {
  const tone = processTone(score.total);
  return (
    <div className="surface-card p-5 md:p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">Process Quality</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Independent of P&amp;L. Built from your behavior.
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              tone === "strong" && "text-success",
              tone === "soft" && "text-warning",
            )}
          >
            {score.total}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Today
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => (
          <div key={key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{LABELS[key]}</span>
              <span className="tabular-nums">{score[key]}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary/70 transition-all"
                style={{ width: `${score[key]}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

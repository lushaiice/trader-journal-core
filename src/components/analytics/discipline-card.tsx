import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { DisciplineAnalytics } from "@/types/analytics";
import { AnalyticsEmptyState } from "./analytics-empty-state";

interface Props {
  data: DisciplineAnalytics;
}

export function DisciplineCard({ data }: Props) {
  if (data.totalLogs === 0) {
    return (
      <AnalyticsEmptyState
        icon={ShieldCheck}
        title="No discipline data yet"
        description="Check rules when journaling trades to see how you're holding up."
      />
    );
  }

  const score = data.averageScore ?? 0;

  return (
    <div className="surface-card p-4 md:p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Discipline score</span>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{score}%</span>
        </div>
        <Progress value={score} className="h-1.5" />
        <p className="text-[11px] text-muted-foreground mt-2">
          Based on {data.totalLogs} rule check-ins · {data.totalViolations} violations
        </p>
      </div>

      {data.topViolations.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-warning" />
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Most broken rules
            </h4>
          </div>
          <ul className="space-y-2">
            {data.topViolations.map((r) => {
              const pct = r.total ? r.violated / r.total : 0;
              return (
                <li key={r.rule} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate">{r.rule}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {r.violated}/{r.total}
                    </span>
                  </div>
                  <Progress value={pct * 100} className="h-1" />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

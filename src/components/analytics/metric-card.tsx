import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export type MetricTone = "neutral" | "positive" | "negative" | "warning";

interface Props {
  label: string;
  value: string;
  tone?: MetricTone;
  hint?: string;
  tooltip?: string;
  icon?: LucideIcon;
  className?: string;
}

const TONE: Record<MetricTone, string> = {
  neutral: "text-foreground",
  positive: "text-success",
  negative: "text-destructive",
  warning: "text-warning",
};

export function MetricCard({
  label,
  value,
  tone = "neutral",
  hint,
  tooltip,
  icon: Icon,
  className,
}: Props) {
  return (
    <div className={cn("surface-card p-4 md:p-5 flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
            {label}
          </span>
        </div>
        {tooltip && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className={cn("text-xl md:text-2xl font-semibold tabular-nums tracking-tight", TONE[tone])}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

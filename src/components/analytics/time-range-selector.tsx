import { cn } from "@/lib/utils";
import type { TimeRangeKey } from "@/types/analytics";

const RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: "7D", label: "7D" },
  { key: "1M", label: "1M" },
  { key: "YTD", label: "YTD" },
  { key: "1Y", label: "1Y" },
  { key: "3Y", label: "3Y" },
  { key: "ALL", label: "All" },
];

interface Props {
  value: TimeRangeKey;
  onChange: (v: TimeRangeKey) => void;
  className?: string;
}

export function TimeRangeSelector({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border bg-card/50 p-1 overflow-x-auto",
        className,
      )}
      role="tablist"
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap tabular-nums",
              active
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

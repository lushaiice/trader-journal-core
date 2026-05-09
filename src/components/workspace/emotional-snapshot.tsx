import { cn } from "@/lib/utils";

interface Metric {
  label: string;
  value: number | null;
  /** Max value (default 5) */
  max?: number;
  /** When true, lower is better (e.g., revenge urge) */
  invert?: boolean;
}

export function EmotionalSnapshot({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="surface-card p-5 md:p-6">
      <div className="mb-4">
        <h3 className="font-medium">Emotional snapshot</h3>
        <p className="text-xs text-muted-foreground mt-0.5">From your latest trades today.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <Ring key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}

function Ring({ label, value, max = 5, invert }: Metric) {
  const v = value ?? 0;
  const pct = max ? (v / max) * 100 : 0;
  const healthy = invert ? v <= max / 2 : v >= max / 2;
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 flex flex-col items-center text-center">
      <div
        className="relative h-12 w-12 rounded-full"
        style={{
          background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-muted) 0)`,
        }}
      >
        <div className="absolute inset-1 rounded-full bg-card flex items-center justify-center">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              value == null && "text-muted-foreground",
              value != null && (healthy ? "text-foreground" : "text-warning"),
            )}
          >
            {value == null ? "—" : value}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{label}</p>
    </div>
  );
}

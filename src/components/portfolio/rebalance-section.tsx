import { useMemo, useState, useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeRebalance, type RebalanceAction } from "@/lib/portfolio/rebalance";
import type { Holding } from "@/lib/portfolio/holdings";

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const NUM = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

interface Props {
  holdings: Holding[]; // priced equity holdings
}

function currentWeights(holdings: Holding[]): Record<string, number> {
  const total = holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  for (const h of holdings) {
    out[h.symbol] = ((h.marketValue ?? 0) / total) * 100;
  }
  return out;
}

export function RebalanceSection({ holdings }: Props) {
  const priced = useMemo(
    () => holdings.filter((h) => h.hasPrice && h.marketValue != null),
    [holdings],
  );

  const defaults = useMemo(() => currentWeights(priced), [priced]);
  const [targets, setTargets] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, v.toFixed(2)])),
  );

  // Reset when holdings identity changes (new priced set)
  const sig = priced.map((h) => h.symbol).join("|");
  useEffect(() => {
    setTargets(Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, v.toFixed(2)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const numericTargets = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(targets)) {
      const n = parseFloat(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  }, [targets]);

  const input = useMemo(
    () =>
      priced.map((h) => ({
        symbol: h.symbol,
        marketValue: h.marketValue ?? 0,
        lastClose: h.lastClose,
      })),
    [priced],
  );

  const result = useMemo(() => computeRebalance(input, numericTargets), [input, numericTargets]);

  const resetToCurrent = () => {
    setTargets(Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, v.toFixed(2)])));
  };

  return (
    <section className="mb-8">
      <h2 className="eyebrow mb-3">Rebalance</h2>

      <div className="surface-card p-4 md:p-5 mb-3 border-l-2 border-primary/50 bg-primary/5">
        <p className="text-xs md:text-sm text-foreground leading-relaxed">
          <span className="font-medium">This is a calculation tool, not investment advice.</span> It
          shows the math to reach the target weights you set — nothing more. It never recommends
          securities, promises outcomes, or places orders. You decide and act.
        </p>
      </div>

      {priced.length === 0 ? (
        <div className="surface-card p-6 text-sm text-muted-foreground text-center">
          No priced holdings to rebalance yet.
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <div className="text-xs text-muted-foreground">
              Targets sum to{" "}
              <span
                className={cn(
                  "font-mono tabular-nums",
                  result.overAllocated ? "text-destructive" : "text-foreground",
                )}
              >
                {result.targetsSumPct.toFixed(2)}%
              </span>{" "}
              ·{" "}
              <span className="font-mono tabular-nums text-foreground">
                {Math.max(0, result.unallocatedPct).toFixed(2)}%
              </span>{" "}
              cash
            </div>
            <Button variant="outline" size="sm" onClick={resetToCurrent}>
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Reset to current
            </Button>
          </div>

          {result.overAllocated && (
            <div className="surface-card p-3 mb-3 flex items-start gap-2 border-l-2 border-destructive/60 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground">
                Targets exceed 100% — reduce to allocate within your book.
              </p>
            </div>
          )}

          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <Th>Symbol</Th>
                    <Th align="right">Current %</Th>
                    <Th align="right">Target %</Th>
                    <Th align="right">Current value</Th>
                    <Th align="right">Target value</Th>
                    <Th align="center">Action</Th>
                    <Th align="right">Δ value</Th>
                    <Th align="right">Δ shares</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => {
                    const tone =
                      row.action === "buy"
                        ? "text-success"
                        : row.action === "sell"
                          ? "text-destructive"
                          : "text-muted-foreground";
                    return (
                      <tr
                        key={row.symbol}
                        className="border-b border-border/40 last:border-b-0 hover:bg-muted/30"
                      >
                        <Td>
                          <span className="font-medium">{row.symbol}</span>
                        </Td>
                        <Td align="right" mono>
                          {(row.currentWeight * 100).toFixed(2)}%
                        </Td>
                        <Td align="right">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="0.1"
                            value={targets[row.symbol] ?? ""}
                            onChange={(e) =>
                              setTargets((prev) => ({ ...prev, [row.symbol]: e.target.value }))
                            }
                            className="h-8 w-20 ml-auto text-right font-mono tabular-nums"
                            aria-label={`Target percent for ${row.symbol}`}
                          />
                        </Td>
                        <Td align="right" mono>
                          {INR.format(row.marketValue)}
                        </Td>
                        <Td align="right" mono>
                          {INR.format(row.targetValue)}
                        </Td>
                        <Td align="center">
                          <ActionBadge action={row.action} />
                        </Td>
                        <Td align="right" mono className={tone}>
                          {row.action === "hold"
                            ? "—"
                            : `${row.deltaValue > 0 ? "+" : ""}${INR.format(row.deltaValue)}`}
                        </Td>
                        <Td align="right" mono className={tone}>
                          {row.deltaShares == null
                            ? "—"
                            : row.action === "hold"
                              ? "—"
                              : `~${row.deltaShares > 0 ? "+" : ""}${NUM.format(row.deltaShares)} sh`}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-2">
            Values use the last cached end-of-day close. Assumes total portfolio value is held
            constant — no new capital added.
          </p>
        </>
      )}
    </section>
  );
}

function ActionBadge({ action }: { action: RebalanceAction }) {
  const styles =
    action === "buy"
      ? "bg-success/10 text-success"
      : action === "sell"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium",
        styles,
      )}
    >
      {action}
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "eyebrow px-4 py-2.5 text-muted-foreground font-normal",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono = false,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        mono && "font-mono tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

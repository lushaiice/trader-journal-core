import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { PieChart, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/analytics/metric-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTradesQuery } from "@/lib/trades/api";
import { normalizeTrades } from "@/lib/analytics/normalize";
import { useLatestPrices, useMarketDataFreshness, type LatestPrice } from "@/lib/market/api";
import { buildHoldings, type Holding, type PriceRef } from "@/lib/portfolio/holdings";
import { computeAllocation, computeConcentration } from "@/lib/portfolio/risk";
import { useCapitalState } from "@/hooks/capital";
import { cn } from "@/lib/utils";
import { BenchmarkSection } from "@/components/portfolio/benchmark-section";
import { RebalanceSection } from "@/components/portfolio/rebalance-section";
import { RiskCharts } from "@/components/portfolio/risk-charts";

export const Route = createFileRoute("/_app/portfolio")({
  component: () => (
    <SectionErrorBoundary
      title="Portfolio is temporarily unavailable."
      description="Your holdings are safely stored. Try again in a moment."
    >
      <PortfolioPage />
    </SectionErrorBoundary>
  ),
});

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const PCT = (n: number) => `${(n * 100).toFixed(2)}%`;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function PortfolioPage() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const tradesQuery = useTradesQuery();

  const normalized = useMemo(
    () => (tradesQuery.data ? normalizeTrades(tradesQuery.data) : []),
    [tradesQuery.data],
  );

  const openTrades = useMemo(
    () => normalized.filter((t) => t.status === "open" || t.status === "partial"),
    [normalized],
  );

  const symbols = useMemo(() => {
    const s = new Set<string>();
    for (const t of openTrades) {
      if (String(t.raw.trade.instrument_type ?? "equity") === "equity") {
        s.add(t.symbol);
      }
    }
    return Array.from(s);
  }, [openTrades]);

  const pricesQuery = useLatestPrices(symbols);
  const freshness = useMarketDataFreshness();

  const priceBySymbol = useMemo(() => {
    const map: Record<string, PriceRef | undefined> = {};
    for (const p of (pricesQuery.data ?? []) as LatestPrice[]) {
      map[p.symbol] = { close: p.close, price_date: p.price_date };
    }
    return map;
  }, [pricesQuery.data]);

  const result = useMemo(
    () => buildHoldings(openTrades, priceBySymbol),
    [openTrades, priceBySymbol],
  );

  const capital = useCapitalState();
  const inceptionDate = useMemo<string | null>(() => {
    if (!capital.events.length) return null;
    let earliest = capital.events[0].eventDate;
    for (const e of capital.events) if (e.eventDate < earliest) earliest = e.eventDate;
    return earliest;
  }, [capital.events]);

  const concentration = useMemo(() => computeConcentration(result.holdings), [result.holdings]);
  const allocation = useMemo(
    () => computeAllocation(openTrades, priceBySymbol, capital.baseCapital),
    [openTrades, priceBySymbol, capital.baseCapital],
  );

  const handleRefresh = async () => {
    if (refreshing || symbols.length === 0) return;
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-market-data", {
        body: { symbols },
      });
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["market", "latest-prices"] }),
        qc.invalidateQueries({ queryKey: ["market", "freshness"] }),
      ]);
      toast.success("Prices refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh prices");
    } finally {
      setRefreshing(false);
    }
  };

  const loading = tradesQuery.isLoading;
  const hasAnyOpen =
    openTrades.length > 0 &&
    result.holdings.length + result.unpricedEquity.length + result.derivatives.length > 0;

  const pnlTone =
    result.totals.unrealizedPnl > 0
      ? "positive"
      : result.totals.unrealizedPnl < 0
        ? "negative"
        : "neutral";
  const pnlPctLabel = result.totals.unrealizedPct == null ? "—" : PCT(result.totals.unrealizedPct);

  const asOf = freshness.data?.fetchedAt
    ? new Date(freshness.data.fetchedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <>
      <PageHeader
        title="Portfolio"
        description="Your open holdings, valued at the last cached end-of-day close."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || symbols.length === 0}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh prices
          </Button>
        }
      />

      <div className="surface-card p-3 md:p-4 mb-6 text-xs text-muted-foreground flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <span>
          Market data: <span className="text-foreground">Yahoo Finance</span> — end-of-day, delayed.
          Not a live quote.
        </span>
        <span>
          {asOf ? <>Last synced {asOf}</> : "No sync yet"}
          {freshness.data?.fetchedAt && result.holdings[0]?.priceDate ? (
            <> · latest close {fmtDate(result.holdings[0].priceDate)}</>
          ) : null}
        </span>
      </div>

      {loading ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Loading portfolio…
        </div>
      ) : !hasAnyOpen ? (
        <EmptyState
          icon={PieChart}
          title="No open positions to value"
          description="Import or log a trade to see your book here."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            <MetricCard
              label="Current value"
              value={INR.format(result.totals.marketValue)}
              hint={`${result.totals.pricedCount} priced`}
            />
            <MetricCard label="Invested (cost)" value={INR.format(result.totals.costValue)} />
            <MetricCard
              label="Unrealized P&L"
              tone={pnlTone}
              value={INR.format(result.totals.unrealizedPnl)}
              hint={pnlPctLabel}
            />
            <MetricCard
              label="Holdings"
              value={String(result.holdings.length + result.unpricedEquity.length)}
              hint={
                result.totals.unpricedCount
                  ? `${result.totals.unpricedCount} pending price`
                  : undefined
              }
            />
          </div>

          {(result.holdings.length > 0 || result.unpricedEquity.length > 0) && (
            <section className="mb-8">
              <h2 className="eyebrow mb-3">Equity holdings</h2>
              <HoldingsTable holdings={[...result.holdings, ...result.unpricedEquity]} />
            </section>
          )}

          {result.derivatives.length > 0 && (
            <section className="mb-8">
              <h2 className="eyebrow mb-1">Derivatives</h2>
              <p className="text-xs text-muted-foreground mb-3">
                No end-of-day price — shown at entry cost only.
              </p>
              <DerivativesList holdings={result.derivatives} />
            </section>
          )}

          <RiskCharts
            trades={normalized}
            capitalBase={capital.baseCapital}
            inceptionDate={inceptionDate}
          />

          <AllocationSection
            allocation={allocation}
            weights={concentration.weights}
            capitalBase={capital.baseCapital}
            topWeight={concentration.topWeight}
            topSymbol={concentration.weights[0]?.symbol ?? null}
            herfindahl={concentration.herfindahl}
          />

          <BenchmarkSection
            trades={normalized}
            capitalBase={capital.baseCapital}
            inceptionDate={inceptionDate}
          />

          <RebalanceSection holdings={result.holdings} />
        </>
      )}
    </>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              <Th>Symbol</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Avg cost</Th>
              <Th align="right">Last close</Th>
              <Th align="right">Market value</Th>
              <Th align="right">Unrealized ₹</Th>
              <Th align="right">Unrealized %</Th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const pnlTone =
                h.unrealizedPnl == null
                  ? ""
                  : h.unrealizedPnl > 0
                    ? "text-success"
                    : h.unrealizedPnl < 0
                      ? "text-destructive"
                      : "";
              return (
                <tr
                  key={h.symbol}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/30"
                >
                  <Td>
                    <span className="font-medium">{h.symbol}</span>
                  </Td>
                  <Td align="right" mono>
                    {NUM.format(h.quantity)}
                  </Td>
                  <Td align="right" mono>
                    {INR.format(h.avgCost)}
                  </Td>
                  <Td align="right" mono>
                    {h.hasPrice && h.lastClose != null ? (
                      <>
                        <div>{INR.format(h.lastClose)}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {fmtDate(h.priceDate)}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">price pending</span>
                    )}
                  </Td>
                  <Td align="right" mono>
                    {h.marketValue != null ? INR.format(h.marketValue) : "—"}
                  </Td>
                  <Td align="right" mono className={pnlTone}>
                    {h.unrealizedPnl != null ? INR.format(h.unrealizedPnl) : "—"}
                  </Td>
                  <Td align="right" mono className={pnlTone}>
                    {h.unrealizedPct != null ? PCT(h.unrealizedPct) : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DerivativesList({ holdings }: { holdings: Holding[] }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              <Th>Symbol</Th>
              <Th align="right">Qty</Th>
              <Th align="right">Avg entry</Th>
              <Th align="right">Cost value</Th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol} className="border-b border-border/40 last:border-b-0">
                <Td>
                  <span className="font-medium">{h.symbol}</span>
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {h.instrumentType}
                  </span>
                </Td>
                <Td align="right" mono>
                  {NUM.format(h.quantity)}
                </Td>
                <Td align="right" mono>
                  {INR.format(h.avgCost)}
                </Td>
                <Td align="right" mono>
                  {INR.format(h.costValue)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "eyebrow px-4 py-2.5 text-muted-foreground font-normal",
        align === "right" ? "text-right" : "text-left",
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
  align?: "left" | "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        align === "right" ? "text-right" : "text-left",
        mono && "font-mono tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

// ─────────────────────── Allocation section ─────────────────────────

function ShareBar({
  a,
  b,
  labelA,
  labelB,
}: {
  a: { value: number; share: number };
  b: { value: number; share: number };
  labelA: string;
  labelB: string;
}) {
  const aPct = a.share * 100;
  const bPct = b.share * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">
          {labelA}{" "}
          <span className="text-foreground font-mono tabular-nums">{aPct.toFixed(1)}%</span>
        </span>
        <span className="text-muted-foreground">
          <span className="text-foreground font-mono tabular-nums">{bPct.toFixed(1)}%</span>{" "}
          {labelB}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
        <div className="h-full bg-primary" style={{ width: `${aPct}%` }} />
        <div className="h-full bg-accent" style={{ width: `${bPct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1 font-mono tabular-nums">
        <span>{INR.format(a.value)}</span>
        <span>{INR.format(b.value)}</span>
      </div>
    </div>
  );
}

function AllocationSection({
  allocation,
  weights,
  capitalBase,
  topWeight,
  topSymbol,
  herfindahl,
}: {
  allocation: ReturnType<typeof computeAllocation>;
  weights: { symbol: string; weight: number }[];
  capitalBase: number;
  topWeight: number | null;
  topSymbol: string | null;
  herfindahl: number | null;
}) {
  const hasDeployed = allocation.deployedValue > 0;
  const concLabel =
    topWeight == null
      ? "—"
      : `${(topWeight * 100).toFixed(1)}%${topSymbol ? ` · ${topSymbol}` : ""}`;
  const concHint = herfindahl == null ? "No priced holdings" : `HHI ${herfindahl.toFixed(2)}`;
  return (
    <section className="mb-8">
      <h2 className="eyebrow mb-3">Allocation &amp; exposure</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="surface-card p-4 md:p-5 flex flex-col gap-4 md:col-span-2">
          {hasDeployed ? (
            <>
              <ShareBar
                a={allocation.byInstrument.equity}
                b={allocation.byInstrument.derivatives}
                labelA="Equity"
                labelB="Derivatives"
              />
              <ShareBar
                a={allocation.byDirection.long}
                b={allocation.byDirection.short}
                labelA="Long"
                labelB="Short"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No open positions to allocate.</p>
          )}
        </div>
        <div className="surface-card p-4 md:p-5 flex flex-col gap-2">
          <span className="eyebrow text-muted-foreground">Deployed vs capital</span>
          <p className="font-display text-xl md:text-2xl font-semibold tabular-nums tracking-tight">
            {allocation.exposurePct == null ? "—" : `${(allocation.exposurePct * 100).toFixed(1)}%`}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
            {INR.format(allocation.deployedValue)}
            {capitalBase > 0 ? <> of {INR.format(capitalBase)}</> : null}
          </p>
          {allocation.exposurePct == null && (
            <p className="text-[11px] text-muted-foreground">
              Set an initial capital event to see exposure.
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <span className="eyebrow text-muted-foreground">Concentration</span>
            <p className="font-display text-lg font-semibold tabular-nums tracking-tight mt-1">
              {concLabel}
            </p>
            <p className="text-[11px] text-muted-foreground">{concHint}</p>
          </div>
        </div>
      </div>

      {weights.length > 0 && (
        <div className="surface-card p-4 md:p-5 mt-4">
          <span className="eyebrow text-muted-foreground">Top holdings by weight</span>
          <ul className="mt-3 flex flex-col gap-2">
            {weights.slice(0, 5).map((w) => (
              <li key={w.symbol} className="flex items-center gap-3 text-sm">
                <span className="w-28 truncate font-medium">{w.symbol}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(w.weight * 100).toFixed(2)}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono tabular-nums text-xs">
                  {(w.weight * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

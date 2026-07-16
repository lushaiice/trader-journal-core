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
import {
  useLatestPrices,
  useMarketDataFreshness,
  type LatestPrice,
} from "@/lib/market/api";
import { buildHoldings, type Holding, type PriceRef } from "@/lib/portfolio/holdings";
import { cn } from "@/lib/utils";

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
      toast.error(
        err instanceof Error ? err.message : "Could not refresh prices",
      );
    } finally {
      setRefreshing(false);
    }
  };

  const loading = tradesQuery.isLoading;
  const hasAnyOpen =
    openTrades.length > 0 &&
    (result.holdings.length + result.unpricedEquity.length + result.derivatives.length) > 0;

  const pnlTone =
    result.totals.unrealizedPnl > 0
      ? "positive"
      : result.totals.unrealizedPnl < 0
        ? "negative"
        : "neutral";
  const pnlPctLabel =
    result.totals.unrealizedPct == null
      ? "—"
      : PCT(result.totals.unrealizedPct);

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
          Market data: <span className="text-foreground">Yahoo Finance</span> —
          end-of-day, delayed. Not a live quote.
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
            <MetricCard
              label="Invested (cost)"
              value={INR.format(result.totals.costValue)}
            />
            <MetricCard
              label="Unrealized P&L"
              tone={pnlTone}
              value={INR.format(result.totals.unrealizedPnl)}
              hint={pnlPctLabel}
            />
            <MetricCard
              label="Holdings"
              value={String(
                result.holdings.length + result.unpricedEquity.length,
              )}
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
              <HoldingsTable
                holdings={[...result.holdings, ...result.unpricedEquity]}
              />
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
                      <span className="text-muted-foreground italic text-xs">
                        price pending
                      </span>
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
              <tr
                key={h.symbol}
                className="border-b border-border/40 last:border-b-0"
              >
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

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
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

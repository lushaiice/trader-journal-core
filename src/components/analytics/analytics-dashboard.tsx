import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  History,
  PlusCircle,
  Wallet,
  Target,
  Activity,
  Scale,
  TrendingDown,
  Trophy,
  Sigma,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortfolioAnalytics } from "@/hooks/analytics";
import { useTradesQuery } from "@/lib/trades/api";
import { formatINR } from "@/lib/trades/calculations";
import { formatPercent, formatRatio, formatRMultiple } from "@/lib/analytics/format";
import type { TimeRangeKey } from "@/types/analytics";
import { TradeCard } from "@/components/trades/trade-card";
import { TradeDetailModal } from "@/components/trades/trade-detail-modal";
import { TimeRangeSelector } from "./time-range-selector";
import { MetricCard } from "./metric-card";
import { DrawdownChart } from "./drawdown-chart";
import { AnalyticsSection } from "./analytics-section";
import { EmotionalInsightCard } from "./emotional-insight-card";
import { DisciplineCard } from "./discipline-card";
import { TagAnalyticsTable } from "./tag-analytics-table";
import { AnalyticsEmptyState } from "./analytics-empty-state";
import { DailyReflection } from "./daily-reflection";
import { AnalyticsSkeleton } from "./analytics-skeleton";
import {
  CapitalAwareEquityChart,
  FirstCapitalPrompt,
} from "@/components/capital";
import { useCapitalState } from "@/hooks/capital";
import {
  buildCapitalAdjustedEquityCurve,
  computeCapitalAdjustedReturn,
} from "@/lib/capital";

interface Props {
  baseCapital?: number;
}

export function AnalyticsDashboard({ baseCapital: baseCapitalProp }: Props) {
  const [range, setRange] = useState<TimeRangeKey>("1M");
  const capital = useCapitalState();
  const baseCapital = baseCapitalProp ?? capital.baseCapital;
  const analytics = usePortfolioAnalytics({ range, baseCapital });
  const { data: rawTrades } = useTradesQuery();
  const [activeId, setActiveId] = useState<string | null>(null);

  if (analytics.isLoading) return <AnalyticsSkeleton />;

  const { summary, equityCurve, drawdownSeries, drawdown, emotional, discipline, tags, filteredTrades } =
    analytics;

  const adjustedCurve = buildCapitalAdjustedEquityCurve(
    equityCurve.map((p) => ({
      date: p.date,
      netPnl: p.dailyPnl,
      tradesClosed: p.tradesClosed,
    })),
    capital.events,
  );
  const capitalReturn = computeCapitalAdjustedReturn(adjustedCurve);

  const hasAnyTrades = analytics.trades.length > 0;
  const hasRangeData = filteredTrades.length > 0;

  if (!hasAnyTrades) {
    return (
      <AnalyticsEmptyState
        icon={BarChart3}
        title="Your analytics begin with your first trade"
        description="Once you log a trade, performance, behavior, and discipline insights will appear here — calmly and clearly."
      />
    );
  }

  const recent = (rawTrades ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.trade.entry_date).getTime() - new Date(a.trade.entry_date).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-8 md:space-y-10">
      <FirstCapitalPrompt />
      {/* Sticky filter bar (mobile-friendly) */}
      <div className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <TimeRangeSelector value={range} onChange={setRange} />
          <span className="hidden md:inline text-[11px] text-muted-foreground tabular-nums">
            {filteredTrades.length} trade{filteredTrades.length === 1 ? "" : "s"} in range
          </span>
        </div>
      </div>

      {/* Summary metrics */}
      <AnalyticsSection
        title="Overview"
        description="Headline performance for the selected range."
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            label="Net P&L"
            value={formatINR(summary.totalNetPnl)}
            tone={summary.totalNetPnl >= 0 ? "positive" : "negative"}
            icon={Wallet}
            hint={`${summary.closedCount} closed`}
            tooltip="Total realized P&L net of fees within range."
          />
          <MetricCard
            label="Win rate"
            value={formatPercent(summary.winRate)}
            icon={Target}
            hint={`${summary.wins}W · ${summary.losses}L`}
            tooltip="Wins ÷ realized trades in range."
          />
          <MetricCard
            label="Profit factor"
            value={formatRatio(summary.profitFactor)}
            tone={
              summary.profitFactor != null && summary.profitFactor >= 1.5
                ? "positive"
                : summary.profitFactor != null && summary.profitFactor < 1
                  ? "negative"
                  : "neutral"
            }
            icon={Scale}
            tooltip="Gross profit ÷ gross loss. Above 1.5 is healthy."
          />
          <MetricCard
            label="Expectancy"
            value={summary.expectancy != null ? formatINR(summary.expectancy) : "—"}
            tone={
              summary.expectancy != null && summary.expectancy >= 0 ? "positive" : "negative"
            }
            icon={Sigma}
            tooltip="Average net P&L per trade in range."
          />
          <MetricCard
            label="Average R"
            value={formatRMultiple(summary.avgRMultiple)}
            tone={
              summary.avgRMultiple != null && summary.avgRMultiple >= 0
                ? "positive"
                : "negative"
            }
            icon={Activity}
            tooltip="Average R-multiple — reward relative to risk per trade."
          />
          <MetricCard
            label="Max drawdown"
            value={formatPercent(drawdown.maxDrawdownPct)}
            tone={drawdown.maxDrawdownPct < 0 ? "negative" : "neutral"}
            icon={TrendingDown}
            hint={drawdown.currentDrawdownPct < 0 ? `Now ${formatPercent(drawdown.currentDrawdownPct)}` : "Recovered"}
            tooltip="Largest peak-to-trough decline in equity."
          />
          <MetricCard
            label="Sharpe"
            value={formatRatio(summary.sharpeRatio)}
            icon={Trophy}
            tooltip="Per-trade Sharpe ratio (return ÷ stdev)."
          />
          <MetricCard
            label="Adjusted return"
            value={formatPercent(capitalReturn.capitalAdjustedReturn)}
            tone={
              capitalReturn.capitalAdjustedReturn != null &&
              capitalReturn.capitalAdjustedReturn >= 0
                ? "positive"
                : "negative"
            }
            icon={Wallet}
            hint={baseCapital > 0 ? `Base ${formatINR(baseCapital)}` : "Set capital"}
            tooltip="Net trading P&L ÷ average deployed capital. Excludes deposits and withdrawals."
          />
          <MetricCard
            label="Total trades"
            value={String(summary.tradeCount)}
            icon={Hash}
            hint={`${summary.openCount} open`}
          />
        </div>
      </AnalyticsSection>

      {/* Equity & Drawdown */}
      <AnalyticsSection
        title="Equity & drawdown"
        description="Cumulative P&L over time and the underwater periods that shape it."
      >
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <CapitalAwareEquityChart data={adjustedCurve} />
          </div>
          <DrawdownChart data={drawdownSeries} />
        </div>
      </AnalyticsSection>

      {/* Behavioral analytics */}
      <AnalyticsSection
        title="Behavioral patterns"
        description="How your emotional state shaped your outcomes."
      >
        <div className="grid md:grid-cols-2 gap-4">
          <EmotionalInsightCard
            title="Confidence vs avg P&L"
            description="Were you better at trading when conviction was high?"
            scaleLow="Hesitant"
            scaleHigh="Confident"
            buckets={emotional.confidence}
          />
          <EmotionalInsightCard
            title="Emotional state vs avg P&L"
            description="Calm vs heightened emotional state outcomes."
            scaleLow="Calm"
            scaleHigh="Activated"
            buckets={emotional.emotionLevel}
          />
          <EmotionalInsightCard
            title="Discipline feel vs avg P&L"
            description="How your felt discipline tracks with results."
            scaleLow="Loose"
            scaleHigh="Locked-in"
            buckets={emotional.disciplineFeel}
          />
          <EmotionalInsightCard
            title="Recovery urge vs avg P&L"
            description="Trading to 'get back' — does it work?"
            scaleLow="Patient"
            scaleHigh="Urgent"
            buckets={emotional.recoveryUrge}
          />
        </div>
      </AnalyticsSection>

      {/* Discipline + reflection */}
      <AnalyticsSection
        title="Discipline & reflection"
        description="Self-aware traders compound. Notice patterns without judgment."
      >
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <DisciplineCard data={discipline} />
          </div>
          <DailyReflection
            trades={analytics.trades}
            disciplineToday={discipline.averageScore}
          />
        </div>
      </AnalyticsSection>

      {/* Tags */}
      <AnalyticsSection
        title="Setups by performance"
        description="Which tagged setups are paying you — and which aren't."
      >
        <TagAnalyticsTable data={tags} />
      </AnalyticsSection>

      {/* Recent trades */}
      <AnalyticsSection
        title="Recent trades"
        description="Your latest entries, ready to revisit."
        action={
          <Button asChild size="sm" variant="ghost">
            <Link to="/trades">
              <History className="h-3.5 w-3.5 mr-1.5" /> View all
            </Link>
          </Button>
        }
      >
        {recent.length === 0 ? (
          <AnalyticsEmptyState
            icon={History}
            title="No trades yet"
            description="Log your first trade to start building your record."
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {recent.map((t) => (
              <TradeCard
                key={t.trade.id}
                trade={t.trade}
                exits={t.exits}
                discipline={t.discipline}
                onClick={() => setActiveId(t.trade.id)}
              />
            ))}
          </div>
        )}
      </AnalyticsSection>

      {!hasRangeData && (
        <p className="text-xs text-muted-foreground text-center">
          No trades in the selected range — try a wider window above.{" "}
          <Link to="/add-trade" className="text-primary hover:underline">
            <PlusCircle className="h-3 w-3 inline -mt-0.5 mr-0.5" /> Add trade
          </Link>
        </p>
      )}

      <MethodologyNote items={DEFAULT_METHODOLOGY} />

      <TradeDetailModal tradeId={activeId} onClose={() => setActiveId(null)} />
    </div>
  );
}

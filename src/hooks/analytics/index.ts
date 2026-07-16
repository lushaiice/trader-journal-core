/** React hooks for analytics — thin memoized wrappers over pure utilities. */
import { useMemo } from "react";
import { useTrades } from "@/hooks/trades";
import {
  buildDisciplineAnalytics,
  buildDrawdownSeries,
  buildEmotionalAnalytics,
  buildEquityCurve,
  buildPortfolioTimeline,
  buildTimeRange,
  filterTradesByRange,
  normalizeTrades,
  summarizeAnalytics,
  summarizeDrawdown,
  aggregateByTag,
  topPerformingTags,
  worstPerformingTags,
  EMPTY_ANALYTICS_SUMMARY,
} from "@/lib/analytics";
import type {
  AnalyticsSummary,
  DisciplineAnalytics,
  DrawdownPoint,
  DrawdownSummary,
  EmotionalAnalytics,
  EquityPoint,
  NormalizedTrade,
  PortfolioSnapshot,
  TagAnalytics,
  TimeRange,
  TimeRangeKey,
} from "@/types/analytics";

export type AssetFilter = "all" | "equity" | "futures" | "options";
export type SideFilter = "all" | "long" | "short";

export interface UseAnalyticsOptions {
  range?: TimeRangeKey;
  baseCapital?: number;
  assetFilter?: AssetFilter;
  sideFilter?: SideFilter;
}

export interface PortfolioAnalyticsResult {
  isLoading: boolean;
  isError: boolean;
  range: TimeRange;
  trades: NormalizedTrade[];
  filteredTrades: NormalizedTrade[];
  summary: AnalyticsSummary;
  equityCurve: EquityPoint[];
  drawdownSeries: DrawdownPoint[];
  drawdown: DrawdownSummary;
  portfolioTimeline: PortfolioSnapshot[];
  tags: TagAnalytics[];
  topTags: TagAnalytics[];
  worstTags: TagAnalytics[];
  emotional: EmotionalAnalytics;
  discipline: DisciplineAnalytics;
}

export function usePortfolioAnalytics(
  opts: UseAnalyticsOptions = {},
): PortfolioAnalyticsResult {
  const {
    range: rangeKey = "ALL",
    baseCapital = 0,
    assetFilter = "all",
    sideFilter = "all",
  } = opts;
  const { data, isLoading, isError } = useTrades();

  return useMemo(() => {
    const range = buildTimeRange(rangeKey);
    const normalized = normalizeTrades(data ?? []);
    const trades = normalized.filter((t) => {
      if (assetFilter !== "all") {
        const inst = String(t.raw.trade.instrument_type ?? "equity");
        if (inst !== assetFilter) return false;
      }
      if (sideFilter !== "all" && t.side !== sideFilter) return false;
      return true;
    });
    const filteredTrades = filterTradesByRange(trades, range);
    const summary = filteredTrades.length
      ? summarizeAnalytics(filteredTrades)
      : EMPTY_ANALYTICS_SUMMARY;
    const equityCurve = buildEquityCurve(trades, { baseCapital, range });
    const drawdownSeries = buildDrawdownSeries(equityCurve);
    const drawdown = summarizeDrawdown(equityCurve);
    const portfolioTimeline = buildPortfolioTimeline(equityCurve, baseCapital);
    const tags = aggregateByTag(filteredTrades);
    const emotional = buildEmotionalAnalytics(filteredTrades);
    const discipline = buildDisciplineAnalytics(filteredTrades);

    return {
      isLoading,
      isError,
      range,
      trades,
      filteredTrades,
      summary,
      equityCurve,
      drawdownSeries,
      drawdown,
      portfolioTimeline,
      tags,
      topTags: topPerformingTags(filteredTrades),
      worstTags: worstPerformingTags(filteredTrades),
      emotional,
      discipline,
    };
  }, [data, isLoading, isError, rangeKey, baseCapital]);
}

export function useEquityCurve(opts: UseAnalyticsOptions = {}): EquityPoint[] {
  return usePortfolioAnalytics(opts).equityCurve;
}

export function useDrawdownData(opts: UseAnalyticsOptions = {}): DrawdownSummary {
  return usePortfolioAnalytics(opts).drawdown;
}

export function useTagAnalytics(opts: UseAnalyticsOptions = {}): TagAnalytics[] {
  return usePortfolioAnalytics(opts).tags;
}

export function useEmotionalAnalytics(
  opts: UseAnalyticsOptions = {},
): EmotionalAnalytics {
  return usePortfolioAnalytics(opts).emotional;
}

export function useDisciplineAnalytics(
  opts: UseAnalyticsOptions = {},
): DisciplineAnalytics {
  return usePortfolioAnalytics(opts).discipline;
}

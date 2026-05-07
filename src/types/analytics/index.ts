/** Analytics domain types — pure, framework-independent. */
import type {
  TradeRow,
  ExitRow,
  DisciplineRow,
} from "@/lib/trades/calculations";

export type TimeRangeKey = "7D" | "1M" | "1Y" | "3Y" | "YTD" | "ALL";

export interface TimeRange {
  key: TimeRangeKey;
  label: string;
  /** Inclusive start. null = no lower bound. */
  start: Date | null;
  /** Inclusive end. */
  end: Date;
}

export interface NormalizedTrade {
  id: string;
  symbol: string;
  side: "long" | "short";
  status: "open" | "partial" | "closed";
  entryDate: Date;
  closeDate: Date | null;
  entryPrice: number;
  quantity: number;
  filledQty: number;
  remainingQty: number;
  avgExit: number | null;
  grossPnl: number;
  netPnl: number;
  fees: number;
  riskPerUnit: number | null;
  riskAmount: number | null;
  positionExposure: number;
  rMultiple: number | null;
  /** Holding duration in milliseconds (null while open). */
  holdingDurationMs: number | null;
  tags: string[];
  confidence: number | null;
  emotionLevel: number | null;
  recoveryUrge: number | null;
  disciplineFeel: number | null;
  setupMatch: number | null;
  raw: {
    trade: TradeRow;
    exits: ExitRow[];
    discipline: DisciplineRow[];
  };
}

export interface EquityPoint {
  date: Date;
  /** Cumulative net P&L up to this point. */
  cumulativePnl: number;
  /** Equity = baseCapital + cumulativePnl. */
  equity: number;
  /** Net P&L realized on this date alone. */
  dailyPnl: number;
  /** Number of trades closed on this date. */
  tradesClosed: number;
}

export interface DrawdownPoint {
  date: Date;
  equity: number;
  peak: number;
  /** Negative or zero. (equity - peak). */
  drawdown: number;
  /** Negative percentage (-0.12 = -12%). */
  drawdownPct: number;
}

export interface DrawdownSummary {
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  underwater: DrawdownPoint[];
}

export interface AnalyticsSummary {
  tradeCount: number;
  closedCount: number;
  openCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  lossRate: number | null;
  avgWinner: number | null;
  avgLoser: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  sharpeRatio: number | null;
  avgRMultiple: number | null;
  totalNetPnl: number;
  totalGrossPnl: number;
  totalFees: number;
  /** Average holding duration in ms (closed trades only). */
  avgHoldingDurationMs: number | null;
  largestWin: number | null;
  largestLoss: number | null;
}

export interface TagAnalytics {
  tag: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  avgRMultiple: number | null;
  expectancy: number | null;
}

export interface EmotionalAnalyticsBucket {
  /** 1..5 score bucket. */
  score: number;
  trades: number;
  winRate: number | null;
  avgNetPnl: number;
  expectancy: number | null;
}

export interface EmotionalAnalytics {
  confidence: EmotionalAnalyticsBucket[];
  recoveryUrge: EmotionalAnalyticsBucket[];
  emotionLevel: EmotionalAnalyticsBucket[];
  disciplineFeel: EmotionalAnalyticsBucket[];
}

export interface DisciplineRuleStat {
  rule: string;
  total: number;
  followed: number;
  violated: number;
  followRate: number | null;
}

export interface DisciplineAnalytics {
  averageScore: number | null;
  totalLogs: number;
  totalViolations: number;
  trend: { date: Date; score: number; logs: number }[];
  rules: DisciplineRuleStat[];
  topViolations: DisciplineRuleStat[];
}

export interface PortfolioSnapshot {
  date: Date;
  equity: number;
  cumulativePnl: number;
  cumulativeReturnPct: number;
  tradesClosed: number;
}

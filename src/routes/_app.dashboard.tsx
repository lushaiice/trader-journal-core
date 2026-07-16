import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PlusCircle,
  Upload,
  ArrowRight,
  History,
  Wallet,
  Target,
  Sigma,
  Hash,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ConsentNudge } from "@/components/consent-nudge";
import { ImportTradesDialog } from "@/components/trades/import-trades-dialog";
import { TradeCard } from "@/components/trades/trade-card";
import { TradeDetailModal } from "@/components/trades/trade-detail-modal";
import { MetricCard } from "@/components/analytics/metric-card";
import { AnalyticsSection } from "@/components/analytics/analytics-section";
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state";
import { ProcessQualityCard, StreakCard } from "@/components/workspace";
import { useTradesQuery } from "@/lib/trades/api";
import { useCapitalState } from "@/hooks/capital";
import { usePortfolioAnalytics } from "@/hooks/analytics";
import { useTodayPulse } from "@/hooks/use-today-pulse";
import { formatINR } from "@/lib/trades/calculations";
import { formatPercent } from "@/lib/analytics/format";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Traders' OS" },
      {
        name: "description",
        content:
          "Your calm daily mirror: today's behavioral pulse and a performance glance at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const trades = useTradesQuery();
  const capital = useCapitalState();
  const pulse = useTodayPulse();
  const analytics = usePortfolioAnalytics({ range: "1M", baseCapital: capital.baseCapital });
  const [importOpen, setImportOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const hasTrades = (trades.data?.length ?? 0) > 0;
  const hasCapital = (capital.events?.length ?? 0) > 0;
  const hasReflection = (trades.data ?? []).some((t) =>
    Boolean(t.trade.review_notes || t.trade.lessons_learned),
  );

  const recent = useMemo(
    () =>
      (trades.data ?? [])
        .slice()
        .sort(
          (a, b) => new Date(b.trade.entry_date).getTime() - new Date(a.trade.entry_date).getTime(),
        )
        .slice(0, 5),
    [trades.data],
  );

  const { summary } = analytics;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${format(new Date(), "EEEE, d MMMM")} · your daily mirror`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" /> Import
            </Button>
            <Button asChild size="sm">
              <Link to="/add-trade">
                <PlusCircle className="h-4 w-4 mr-2" /> Add trade
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 md:space-y-10">
        <OnboardingChecklist
          hasCapital={hasCapital}
          hasTrades={hasTrades}
          hasReflection={hasReflection}
          hasChecklist={false}
        />

        {/* Today pulse */}
        <SectionErrorBoundary
          title="Today's pulse is temporarily unavailable."
          description="Your journal drafts are safe. Try again in a moment."
        >
          <AnalyticsSection
            title="Today's pulse"
            description="A calm read of your process — independent of P&L."
            action={
              <Button asChild size="sm" variant="ghost">
                <Link to="/today">
                  Open Today <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <ProcessQualityCard score={pulse.score} />
              <StreakCard
                reflection={pulse.reviewStreak}
                checklist={pulse.checklistStreak}
                journal={pulse.journalStreak}
              />
              <JournalStatusCard
                journaledToday={pulse.journaledToday}
                tradesToday={pulse.tradeCount}
                consistencyDays={pulse.consistencyDays}
              />
            </div>
          </AnalyticsSection>
        </SectionErrorBoundary>

        {/* Performance glance */}
        <SectionErrorBoundary
          title="Performance snapshot temporarily unavailable."
          description="Try again in a moment."
        >
          <AnalyticsSection
            title="Performance glance"
            description="Last 30 days — the headlines, nothing more."
            action={
              <Button asChild size="sm" variant="ghost">
                <Link to="/analytics">
                  View full analytics <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            }
          >
            {!hasTrades ? (
              <AnalyticsEmptyState
                icon={Wallet}
                title="No trades yet"
                description="Log or import a trade to see your performance."
              />
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <MetricCard
                  label="Net P&L"
                  value={formatINR(summary.totalNetPnl)}
                  tone={summary.totalNetPnl >= 0 ? "positive" : "negative"}
                  icon={Wallet}
                  hint={`${summary.closedCount} closed`}
                  valueTestId="metric-net-pnl"
                />
                <MetricCard
                  label="Win rate"
                  value={formatPercent(summary.winRate)}
                  icon={Target}
                  hint={`${summary.wins}W · ${summary.losses}L`}
                />
                <MetricCard
                  label="Expectancy"
                  value={summary.expectancy != null ? formatINR(summary.expectancy) : "—"}
                  tone={
                    summary.expectancy != null && summary.expectancy >= 0 ? "positive" : "negative"
                  }
                  icon={Sigma}
                  hint="per trade"
                />
                <MetricCard
                  label="Open positions"
                  value={String(summary.openCount)}
                  icon={Hash}
                  hint={`${summary.tradeCount} total`}
                />
              </div>
            )}
          </AnalyticsSection>
        </SectionErrorBoundary>

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
      </div>

      <ConsentNudge />
      <ImportTradesDialog open={importOpen} onOpenChange={setImportOpen} />
      <TradeDetailModal tradeId={activeId} onClose={() => setActiveId(null)} />
    </>
  );
}

interface JournalStatusProps {
  journaledToday: boolean;
  tradesToday: number;
  consistencyDays: number;
}

function JournalStatusCard({ journaledToday, tradesToday, consistencyDays }: JournalStatusProps) {
  const Icon = journaledToday ? CheckCircle2 : Circle;
  return (
    <div className="surface-card p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">Today at a glance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Small acts, repeated calmly.</p>
        </div>
        <Icon
          className={journaledToday ? "h-5 w-5 text-success" : "h-5 w-5 text-muted-foreground"}
          aria-hidden
        />
      </div>
      <div className="space-y-2 text-sm">
        <Row
          label="Journaled today"
          value={journaledToday ? "Yes" : "Not yet"}
          tone={journaledToday ? "positive" : "muted"}
        />
        <Row label="Trades logged today" value={String(tradesToday)} />
        <Row
          label="Journal streak (last 7d)"
          value={`${consistencyDays} / 7`}
          tone={consistencyDays >= 4 ? "positive" : "muted"}
        />
      </div>
      <Button asChild size="sm" variant="outline" className="w-full">
        <Link to="/today">
          Open Today <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Link>
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "muted";
}) {
  const cls =
    tone === "positive"
      ? "text-success"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { WeeklyReviewCard, type WeeklySummary, TradingCalendar, type CalendarDay } from "@/components/workspace";
import { EmptyState } from "@/components/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/weekly-review")({
  head: () => ({
    meta: [
      { title: "Weekly Review — Trader OS" },
      {
        name: "description",
        content: "Step back, see the week, and refine the next one.",
      },
    ],
  }),
  component: WeeklyReviewPage,
});

function WeeklyReviewPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(cursor, { weekStartsOn: 1 });

  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const start = format(cursor, "yyyy-MM-dd");
      const end = format(weekEnd, "yyyy-MM-dd");

      const { data: trades } = await supabase
        .from("trades")
        .select("id,tags,entry_date")
        .eq("user_id", user.id)
        .gte("entry_date", `${start}T00:00:00`)
        .lte("entry_date", `${end}T23:59:59`);

      const tradeIds = (trades ?? []).map((t) => t.id);

      const { data: exits } = tradeIds.length
        ? await supabase
            .from("trade_exits")
            .select("trade_id,exit_price,quantity,fees")
            .in("trade_id", tradeIds)
        : { data: [] as { trade_id: string; exit_price: number; quantity: number; fees: number | null }[] };

      const { data: discipline } = await supabase
        .from("discipline_logs")
        .select("rule,followed,log_date")
        .eq("user_id", user.id)
        .gte("log_date", start)
        .lte("log_date", end);

      const { data: pql } = await supabase
        .from("process_quality_logs")
        .select("total_score,emotional_score,discipline_score,log_date")
        .eq("user_id", user.id)
        .gte("log_date", start)
        .lte("log_date", end);

      const { data: tradesFull } = tradeIds.length
        ? await supabase
            .from("trades")
            .select("id,entry_price,quantity,side,brokerage,taxes,other_fees,tags,entry_date")
            .in("id", tradeIds)
        : { data: [] as Array<{ id: string; entry_price: number; quantity: number; side: string; brokerage: number | null; taxes: number | null; other_fees: number | null; tags: string[]; entry_date: string }> };

      const exitsByTrade = new Map<string, { exit_price: number; quantity: number; fees: number | null }[]>();
      for (const e of exits ?? []) {
        const arr = exitsByTrade.get(e.trade_id) ?? [];
        arr.push(e);
        exitsByTrade.set(e.trade_id, arr);
      }

      const tagPnl = new Map<string, number>();
      const dailyPnl = new Map<string, number>();
      let totalPnl = 0;
      let wins = 0;
      let realized = 0;

      for (const t of tradesFull ?? []) {
        const tradeExits = exitsByTrade.get(t.id) ?? [];
        if (!tradeExits.length) continue;
        const dir = t.side === "short" ? -1 : 1;
        const grossPnl = tradeExits.reduce(
          (acc, e) => acc + (e.exit_price - t.entry_price) * e.quantity * dir - (e.fees ?? 0),
          0,
        );
        const fees = (t.brokerage ?? 0) + (t.taxes ?? 0) + (t.other_fees ?? 0);
        const net = grossPnl - fees;
        totalPnl += net;
        realized += 1;
        if (net > 0) wins += 1;

        const dKey = format(new Date(t.entry_date), "yyyy-MM-dd");
        dailyPnl.set(dKey, (dailyPnl.get(dKey) ?? 0) + net);
        for (const tag of t.tags ?? []) {
          tagPnl.set(tag, (tagPnl.get(tag) ?? 0) + net);
        }
      }

      const tagsRanked = [...tagPnl.entries()]
        .map(([tag, netPnl]) => ({ tag, netPnl }))
        .sort((a, b) => b.netPnl - a.netPnl);

      const ruleViolations = new Map<string, number>();
      for (const d of discipline ?? []) {
        if (!d.followed) ruleViolations.set(d.rule, (ruleViolations.get(d.rule) ?? 0) + 1);
      }

      const avgProcess = pql?.length
        ? Math.round(pql.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / pql.length)
        : null;
      const avgEmotional = pql?.length
        ? Math.round(pql.reduce((a, b) => a + Number(b.emotional_score ?? 0), 0) / pql.length)
        : null;
      const avgDiscipline = pql?.length
        ? Math.round(pql.reduce((a, b) => a + Number(b.discipline_score ?? 0), 0) / pql.length)
        : null;

      setSummary({
        weekStart: cursor,
        weekEnd,
        trades: trades?.length ?? 0,
        netPnl: totalPnl,
        winRate: realized ? wins / realized : null,
        avgDiscipline,
        avgEmotional,
        avgProcess,
        bestSetups: tagsRanked.filter((t) => t.netPnl > 0).slice(0, 3),
        worstSetups: tagsRanked.filter((t) => t.netPnl < 0).slice(-3).reverse(),
        brokenRules: [...ruleViolations.entries()]
          .map(([rule, count]) => ({ rule, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      });

      const allDays: CalendarDay[] = [];
      for (let i = 0; i < 7; i++) {
        const d = format(addDays(cursor, i), "yyyy-MM-dd");
        allDays.push({
          date: d,
          netPnl: dailyPnl.get(d) ?? 0,
          journaled: pql?.some((p) => p.log_date === d) ?? false,
        });
      }
      setCalendar(allDays);
    })();
  }, [user, cursor, weekEnd]);

  const isCurrentWeek = useMemo(
    () => format(cursor, "yyyy-MM-dd") === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [cursor],
  );

  return (
    <>
      <PageHeader
        title="Weekly review"
        description="Zoom out. Notice the patterns. Adjust gently."
        action={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor((c) => subWeeks(c, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={isCurrentWeek}
              onClick={() => setCursor((c) => addDays(c, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {summary ? (
        <div className="space-y-4 md:space-y-6">
          <WeeklyReviewCard summary={summary} />
          <TradingCalendar days={calendar} />
        </div>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="No data for this week"
          description="Log trades and reflections to see a weekly summary here."
        />
      )}
    </>
  );
}

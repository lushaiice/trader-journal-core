import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, subDays } from "date-fns";
import { PageHeader } from "@/components/page-header";
import {
  ChecklistCard,
  ReflectionEditor,
  ProcessQualityCard,
  EmotionalSnapshot,
  SessionNotes,
  QuickCaptureModal,
  StreakCard,
  ContinuitySummary,
} from "@/components/workspace";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  processQualityScore,
  streakSummary,
  buildInsights,
  type ProcessQualityBreakdown,
  type StreakSummary,
} from "@/lib/behavior";
import {
  fetchJournalDates,
  fetchReviewDates,
  fetchChecklistDates,
  saveDailyJournal,
  saveProcessLog,
} from "@/services/workspace";
import type { ChecklistResponses } from "@/lib/workspace/constants";

export const Route = createFileRoute("/_app/today")({
  head: () => ({
    meta: [
      { title: "Today — Trader OS" },
      { name: "description", content: "Your daily trading workspace and behavioral mirror." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const { user } = useAuth();
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  const [focus, setFocus] = useState("");
  const [marketView, setMarketView] = useState("");
  const [checklist, setChecklist] = useState<ChecklistResponses>({});

  const [emotionAvg, setEmotionAvg] = useState<{
    confidence: number | null;
    emotion: number | null;
    discipline: number | null;
    recovery: number | null;
  }>({ confidence: null, emotion: null, discipline: null, recovery: null });

  const [disciplineFollowRate, setDisciplineFollowRate] = useState<number | null>(null);
  const [journaledToday, setJournaledToday] = useState(false);
  const [consistencyDays, setConsistencyDays] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  // Load today's journal pre-fill (focus stored as market_view or pre_market_notes)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("daily_journals")
        .select("market_view,pre_market_notes")
        .eq("user_id", user.id)
        .eq("journal_date", dateStr)
        .maybeSingle();
      if (data) {
        setMarketView(data.market_view ?? "");
        setFocus(data.pre_market_notes ?? "");
        setJournaledToday(Boolean(data.pre_market_notes || data.market_view));
      }

      // Today's trade emotional averages
      const startOfDay = `${dateStr}T00:00:00`;
      const { data: trades } = await supabase
        .from("trades")
        .select("confidence,emotion_level,discipline_feel,recovery_urge")
        .eq("user_id", user.id)
        .gte("entry_date", startOfDay);
      if (trades?.length) {
        setTradeCount(trades.length);
        const avg = (k: keyof (typeof trades)[number]) => {
          const vals = trades.map((t) => t[k] as number | null).filter((v): v is number => v != null);
          return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
        };
        setEmotionAvg({
          confidence: avg("confidence"),
          emotion: avg("emotion_level"),
          discipline: avg("discipline_feel"),
          recovery: avg("recovery_urge"),
        });
      }

      // Discipline follow rate today
      const { data: disc } = await supabase
        .from("discipline_logs")
        .select("followed")
        .eq("user_id", user.id)
        .eq("log_date", dateStr);
      if (disc?.length) {
        const followed = disc.filter((d) => d.followed).length;
        setDisciplineFollowRate(Math.round((followed / disc.length) * 100));
      }

      // Consistency: journaled days in last 7
      const sevenAgo = format(subDays(today, 6), "yyyy-MM-dd");
      const { data: journals } = await supabase
        .from("daily_journals")
        .select("journal_date")
        .eq("user_id", user.id)
        .gte("journal_date", sevenAgo);
      setConsistencyDays(new Set(journals?.map((j) => j.journal_date)).size);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateStr]);

  // Autosave focus + market view
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      await supabase.from("daily_journals").upsert(
        {
          user_id: user.id,
          journal_date: dateStr,
          market_view: marketView,
          pre_market_notes: focus,
        },
        { onConflict: "user_id,journal_date" },
      );
      setJournaledToday(Boolean(focus || marketView));
    }, 700);
    return () => clearTimeout(t);
  }, [focus, marketView, user, dateStr]);

  const score: ProcessQualityBreakdown = useMemo(
    () =>
      processQualityScore({
        checklist,
        disciplineFollowRate,
        emotionalScoreOf5: emotionAvg.discipline,
        journaledToday,
        consistencyDays,
      }),
    [checklist, disciplineFollowRate, emotionAvg.discipline, journaledToday, consistencyDays],
  );

  // Persist process quality snapshot
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(async () => {
      await supabase.from("process_quality_logs").upsert(
        {
          user_id: user.id,
          log_date: dateStr,
          checklist_score: score.checklist,
          discipline_score: score.discipline,
          emotional_score: score.emotional,
          journaling_score: score.journaling,
          consistency_score: score.consistency,
          total_score: score.total,
        },
        { onConflict: "user_id,log_date" },
      );
    }, 1200);
    return () => clearTimeout(t);
  }, [score, user, dateStr]);

  return (
    <>
      <PageHeader
        title="Today"
        description={`${format(today, "EEEE, d MMMM yyyy")} · ${tradeCount} trades logged`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="surface-card p-5 md:p-6 space-y-5">
            <div>
              <h3 className="font-medium">Pre-market mindset</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Set the tone before the bell. One sentence is enough.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Today's focus</Label>
              <Textarea
                rows={2}
                placeholder="Trade my A+ setups only. Skip the open."
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Market view</Label>
              <Textarea
                rows={2}
                placeholder="Range-bound after yesterday. Watching levels."
                value={marketView}
                onChange={(e) => setMarketView(e.target.value)}
              />
            </div>
          </div>

          <ChecklistCard date={today} onChange={(items) => setChecklist(items)} />

          <SessionNotes />

          <ReflectionEditor date={today} />
        </div>

        <div className="space-y-4 md:space-y-6">
          <ProcessQualityCard score={score} />
          <EmotionalSnapshot
            metrics={[
              { label: "Confidence", value: emotionAvg.confidence },
              { label: "Emotion", value: emotionAvg.emotion, invert: true },
              { label: "Discipline", value: emotionAvg.discipline },
              { label: "Recovery urge", value: emotionAvg.recovery, invert: true },
              { label: "Streak", value: consistencyDays, max: 7 },
            ]}
          />

          <BehavioralInsights
            score={score.total}
            consistency={consistencyDays}
            tradeCount={tradeCount}
          />
        </div>
      </div>

      <QuickCaptureModal />
    </>
  );
}

function BehavioralInsights({
  score,
  consistency,
  tradeCount,
}: {
  score: number;
  consistency: number;
  tradeCount: number;
}) {
  const insights: string[] = [];
  if (consistency >= 5) insights.push(`You've journaled ${consistency} of the last 7 days. Consistency is compounding.`);
  if (score < 50 && tradeCount > 0) insights.push("Process quality is soft today. Slow down before the next trade.");
  if (score >= 75) insights.push("Process is sharp today. Protect this state — fewer trades, higher quality.");
  if (tradeCount === 0) insights.push("No trades yet. Patience is a position too.");

  if (!insights.length) return null;

  return (
    <div className="surface-card p-5 md:p-6">
      <h3 className="font-medium mb-3">Quiet observations</h3>
      <ul className="space-y-2">
        {insights.map((i) => (
          <li
            key={i}
            className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 py-0.5"
          >
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

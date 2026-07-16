/**
 * Read-only "today pulse" — the same behavioral signals that power /today,
 * but without the autosave/editor plumbing. Used by the Dashboard summary.
 * Reuses `@/lib/behavior` for scoring/streak math (no rebuilt logic).
 */
import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  processQualityScore,
  streakSummary,
  type ProcessQualityBreakdown,
  type StreakSummary,
} from "@/lib/behavior";
import {
  fetchJournalDates,
  fetchReviewDates,
  fetchChecklistDates,
} from "@/services/workspace";

const EMPTY_STREAK: StreakSummary = { current: 0, longest: 0, last7: 0, last30: 0 };

export interface TodayPulse {
  loading: boolean;
  score: ProcessQualityBreakdown;
  journaledToday: boolean;
  consistencyDays: number;
  tradeCount: number;
  disciplineFollowRate: number | null;
  journalStreak: StreakSummary;
  reviewStreak: StreakSummary;
  checklistStreak: StreakSummary;
}

export function useTodayPulse(): TodayPulse {
  const { user } = useAuth();
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  const [loading, setLoading] = useState(true);
  const [journaledToday, setJournaledToday] = useState(false);
  const [tradeCount, setTradeCount] = useState(0);
  const [emotionalOf5, setEmotionalOf5] = useState<number | null>(null);
  const [disciplineFollowRate, setDisciplineFollowRate] = useState<number | null>(null);
  const [consistencyDays, setConsistencyDays] = useState(0);
  const [journalStreak, setJournalStreak] = useState<StreakSummary>(EMPTY_STREAK);
  const [reviewStreak, setReviewStreak] = useState<StreakSummary>(EMPTY_STREAK);
  const [checklistStreak, setChecklistStreak] = useState<StreakSummary>(EMPTY_STREAK);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: journal } = await supabase
        .from("daily_journals")
        .select("market_view,pre_market_notes")
        .eq("user_id", user.id)
        .eq("journal_date", dateStr)
        .maybeSingle();

      const startOfDay = `${dateStr}T00:00:00`;
      const { data: trades } = await supabase
        .from("trades")
        .select("discipline_feel")
        .eq("user_id", user.id)
        .gte("entry_date", startOfDay);

      const { data: disc } = await supabase
        .from("discipline_logs")
        .select("followed")
        .eq("user_id", user.id)
        .eq("log_date", dateStr);

      const since = format(subDays(today, 29), "yyyy-MM-dd");
      const [j, r, c] = await Promise.all([
        fetchJournalDates(user.id, since),
        fetchReviewDates(user.id, since),
        fetchChecklistDates(user.id, since),
      ]);

      if (cancelled) return;

      setJournaledToday(Boolean(journal?.pre_market_notes || journal?.market_view));

      if (trades?.length) {
        setTradeCount(trades.length);
        const disciplineFeels = trades
          .map((t) => t.discipline_feel as number | null)
          .filter((v): v is number => v != null);
        setEmotionalOf5(
          disciplineFeels.length
            ? disciplineFeels.reduce((a, b) => a + b, 0) / disciplineFeels.length
            : null,
        );
      }

      if (disc?.length) {
        const followed = disc.filter((d) => d.followed).length;
        setDisciplineFollowRate(Math.round((followed / disc.length) * 100));
      }

      const jDates = j.ok ? j.data : [];
      const rDates = r.ok ? r.data : [];
      const cDates = c.ok ? c.data : [];
      const jSummary = streakSummary(jDates, today);
      setJournalStreak(jSummary);
      setReviewStreak(streakSummary(rDates, today));
      setChecklistStreak(streakSummary(cDates, today));
      setConsistencyDays(jSummary.last7);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateStr]);

  const score = processQualityScore({
    checklist: undefined, // filled in via /today; dashboard shows the recent-behavior baseline
    disciplineFollowRate,
    emotionalScoreOf5: emotionalOf5,
    journaledToday,
    consistencyDays,
  });

  return {
    loading,
    score,
    journaledToday,
    consistencyDays,
    tradeCount,
    disciplineFollowRate,
    journalStreak,
    reviewStreak,
    checklistStreak,
  };
}

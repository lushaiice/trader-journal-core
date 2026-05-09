import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Search, NotebookPen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { JournalTimelineCard, type TimelineDay } from "@/components/workspace";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/journal-timeline")({
  head: () => ({
    meta: [
      { title: "Journal Timeline — Trader OS" },
      {
        name: "description",
        content: "Browse your full journaling history, day by day.",
      },
    ],
  }),
  component: JournalTimelinePage,
});

function JournalTimelinePage() {
  const { user } = useAuth();
  const [days, setDays] = useState<TimelineDay[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: journals }, { data: reviews }, { data: trades }] = await Promise.all([
        supabase
          .from("daily_journals")
          .select(
            "journal_date,pre_market_notes,post_market_notes,lessons,mood,energy,focus",
          )
          .eq("user_id", user.id)
          .order("journal_date", { ascending: false })
          .limit(180),
        supabase
          .from("daily_reviews")
          .select("review_date,did_well,mistakes,improve_tomorrow")
          .eq("user_id", user.id)
          .order("review_date", { ascending: false })
          .limit(180),
        supabase
          .from("trades")
          .select("entry_date,id")
          .eq("user_id", user.id)
          .order("entry_date", { ascending: false })
          .limit(500),
      ]);

      const map = new Map<string, TimelineDay>();
      for (const j of journals ?? []) {
        map.set(j.journal_date, {
          date: j.journal_date,
          journal: j,
          trades: 0,
        });
      }
      for (const r of reviews ?? []) {
        const existing = map.get(r.review_date) ?? { date: r.review_date, trades: 0 };
        map.set(r.review_date, { ...existing, review: r });
      }
      for (const t of trades ?? []) {
        const dateKey = format(new Date(t.entry_date), "yyyy-MM-dd");
        const existing = map.get(dateKey) ?? { date: dateKey, trades: 0 };
        map.set(dateKey, { ...existing, trades: (existing.trades ?? 0) + 1 });
      }

      setDays([...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1)));
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (!query.trim()) return days;
    const q = query.toLowerCase();
    return days.filter((d) => {
      const blob = [
        d.journal?.pre_market_notes,
        d.journal?.post_market_notes,
        d.journal?.lessons,
        d.review?.did_well,
        d.review?.mistakes,
        d.review?.improve_tomorrow,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [days, query]);

  return (
    <>
      <PageHeader
        title="Journal timeline"
        description="Your reflections in chronological order."
      />

      <div className="relative mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search your journal…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No entries yet"
          description="Your daily reflections will appear here as you log them."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <JournalTimelineCard key={d.date} day={d} />
          ))}
        </div>
      )}
    </>
  );
}

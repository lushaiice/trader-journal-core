import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  CHECKLIST_ITEMS,
  type ChecklistResponses,
  checklistCompletion,
  readinessScore,
} from "@/lib/workspace/constants";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Props {
  date?: Date;
  onChange?: (items: ChecklistResponses, score: number) => void;
}

export function ChecklistCard({ date = new Date(), onChange }: Props) {
  const { user } = useAuth();
  const dateStr = format(date, "yyyy-MM-dd");
  const [items, setItems] = useState<ChecklistResponses>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("checklist_responses")
        .select("items")
        .eq("user_id", user.id)
        .eq("log_date", dateStr)
        .maybeSingle();
      if (!active) return;
      setItems((data?.items as ChecklistResponses | undefined) ?? {});
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user, dateStr]);

  const score = useMemo(() => readinessScore(items), [items]);
  const completion = useMemo(() => checklistCompletion(items), [items]);

  useEffect(() => {
    onChange?.(items, score);
  }, [items, score, onChange]);

  const toggle = async (id: string, value: boolean) => {
    if (!user) return;
    const next = { ...items, [id]: value };
    setItems(next);
    const nextScore = readinessScore(next);
    await supabase.from("checklist_responses").upsert(
      {
        user_id: user.id,
        log_date: dateStr,
        items: next,
        readiness_score: nextScore,
      },
      { onConflict: "user_id,log_date" },
    );
  };

  return (
    <div className="surface-card p-5 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">Pre-market checklist</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Honest answers, not perfect ones.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{score}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Readiness</p>
        </div>
      </div>

      <Progress value={completion} className="h-1.5" />

      <ul className="space-y-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const value = items[item.id];
          const checked = value === true;
          return (
            <li key={item.id}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(item.id, !checked)}
                  disabled={loading}
                  className={cn(
                    "flex-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm border transition-colors",
                    value === undefined
                      ? "border-border/60 bg-muted/20 hover:bg-muted/40"
                      : checked
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-muted/40",
                  )}
                >
                  {checked ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-left">{item.question}</span>
                </button>
                {value !== undefined && !item.positive && checked && (
                  <span className="text-[10px] text-warning uppercase tracking-wider">flag</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

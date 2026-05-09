import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface TimelineDay {
  date: string;
  journal?: {
    pre_market_notes?: string | null;
    post_market_notes?: string | null;
    lessons?: string | null;
    mood?: number | null;
    energy?: number | null;
    focus?: number | null;
  } | null;
  review?: {
    did_well?: string | null;
    mistakes?: string | null;
    improve_tomorrow?: string | null;
  } | null;
  trades?: number;
  netPnl?: number;
  disciplineScore?: number | null;
}

export function JournalTimelineCard({ day }: { day: TimelineDay }) {
  const [open, setOpen] = useState(false);
  const date = new Date(day.date);
  const hasContent =
    day.journal?.pre_market_notes ||
    day.journal?.post_market_notes ||
    day.journal?.lessons ||
    day.review?.did_well ||
    day.review?.mistakes ||
    day.review?.improve_tomorrow;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="surface-card overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-center shrink-0 w-12">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {format(date, "MMM")}
            </p>
            <p className="text-xl font-semibold tabular-nums">{format(date, "d")}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{format(date, "EEEE")}</p>
            <p className="text-xs text-muted-foreground truncate">
              {day.trades ?? 0} trades
              {day.netPnl != null && (
                <>
                  {" · "}
                  <span
                    className={cn(
                      day.netPnl > 0 && "text-success",
                      day.netPnl < 0 && "text-destructive",
                    )}
                  >
                    {day.netPnl > 0 ? "+" : ""}
                    {Math.round(day.netPnl).toLocaleString("en-IN")}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-5 pb-5 pt-0 space-y-3 border-t border-border">
          {!hasContent && (
            <p className="text-xs text-muted-foreground py-3">
              No notes for this day.
            </p>
          )}
          {day.journal?.pre_market_notes && (
            <Section title="Pre-market" body={day.journal.pre_market_notes} />
          )}
          {day.journal?.post_market_notes && (
            <Section title="Post-market" body={day.journal.post_market_notes} />
          )}
          {day.review?.did_well && <Section title="Went well" body={day.review.did_well} />}
          {day.review?.mistakes && <Section title="Mistakes" body={day.review.mistakes} />}
          {day.review?.improve_tomorrow && (
            <Section title="Improve tomorrow" body={day.review.improve_tomorrow} />
          )}
          {day.journal?.lessons && <Section title="Lessons" body={day.journal.lessons} />}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

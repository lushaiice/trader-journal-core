import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from "date-fns";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CalendarDay {
  date: string; // yyyy-MM-dd
  netPnl?: number;
  journaled?: boolean;
  disciplineScore?: number | null;
  intensity?: number; // 0..1 activity density
}

interface Props {
  days: CalendarDay[];
}

export function TradingCalendar({ days }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const map = new Map(days.map((d) => [d.date, d]));

  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const grid = eachDayOfInterval({ start, end });
  const today = new Date();

  return (
    <div className="surface-card p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">{format(cursor, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor((c) => subMonths(c, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-muted-foreground mb-1.5 px-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {grid.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const data = map.get(key);
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const pnl = data?.netPnl ?? 0;
          const tone =
            pnl > 0
              ? "bg-success/15 border-success/30"
              : pnl < 0
                ? "bg-destructive/15 border-destructive/30"
                : data?.journaled
                  ? "bg-primary/10 border-primary/30"
                  : "bg-muted/30 border-border/40";
          return (
            <div
              key={key}
              className={cn(
                "aspect-square rounded-md border flex flex-col items-center justify-center text-[11px] tabular-nums transition-colors",
                tone,
                !inMonth && "opacity-40",
                isToday && "ring-1 ring-primary",
              )}
            >
              <span className={cn("text-foreground/80", isToday && "font-semibold")}>
                {format(d, "d")}
              </span>
              {data?.journaled && <span className="h-1 w-1 rounded-full bg-primary mt-0.5" />}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-4 text-[10px] text-muted-foreground">
        <Legend className="bg-success/30" label="Profit" />
        <Legend className="bg-destructive/30" label="Loss" />
        <Legend className="bg-primary/30" label="Journaled" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-sm", className)} />
      <span>{label}</span>
    </div>
  );
}

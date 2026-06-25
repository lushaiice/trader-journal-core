import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { History, PlusCircle, Search, Loader2, Upload, Trash2, CheckSquare, X } from "lucide-react";
import { isAfter, subDays } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TradeCard } from "@/components/trades/trade-card";
import { TradeDetailModal } from "@/components/trades/trade-detail-modal";
import { useTradesQuery, useBulkDeleteTrades, useDeleteAllTrades } from "@/lib/trades/api";
import { netPnl } from "@/lib/trades/calculations";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/trades")({
  component: () => (
    <SectionErrorBoundary
      title="Trade history is temporarily unavailable."
      description="Your trades are safely stored. Try again in a moment."
    >
      <Trades />
    </SectionErrorBoundary>
  ),
});

type AssetFilter = "all" | "equity" | "futures" | "options";
type SideFilter = "all" | "long" | "short";
type TimeFilter = "all" | "7" | "30" | "90";
type SortKey = "latest" | "pnl";

function isNeedsReflection(t: { trade: { confidence: number | null; emotion_level: number | null; recovery_urge: number | null; discipline_feel: number | null; setup_match: number | null; source: string | null } }) {
  return (
    t.trade.source === "csv_import" &&
    t.trade.confidence == null &&
    t.trade.emotion_level == null &&
    t.trade.recovery_urge == null &&
    t.trade.discipline_feel == null &&
    t.trade.setup_match == null
  );
}

function Trades() {
  const { data, isLoading } = useTradesQuery();
  const bulkDelete = useBulkDeleteTrades();
  const deleteAll = useDeleteAllTrades();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [asset, setAsset] = useState<AssetFilter>("all");
  const [side, setSide] = useState<SideFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [needsReflection, setNeedsReflection] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const needsReflectionCount = useMemo(
    () => (data ?? []).filter(isNeedsReflection).length,
    [data],
  );

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (needsReflection) list = list.filter(isNeedsReflection);
    if (search) {
      const q = search.toUpperCase();
      list = list.filter((t) => t.trade.symbol.includes(q));
    }
    if (asset !== "all") list = list.filter((t) => t.trade.instrument_type === asset);
    if (side !== "all") list = list.filter((t) => t.trade.side === side);
    if (time !== "all") {
      const cutoff = subDays(new Date(), Number(time));
      list = list.filter((t) => isAfter(new Date(t.trade.entry_date), cutoff));
    }
    const sorted = [...list];
    if (sort === "latest") {
      sorted.sort(
        (a, b) => new Date(b.trade.entry_date).getTime() - new Date(a.trade.entry_date).getTime(),
      );
    } else {
      sorted.sort((a, b) => netPnl(b.trade, b.exits) - netPnl(a.trade, a.exits));
    }
    return sorted;
  }, [data, needsReflection, search, asset, side, time, sort]);

  return (
    <>
      <PageHeader
        title="Trade History"
        description="Every trade you've logged."
        action={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/import">
                <Upload className="h-4 w-4 mr-2" /> Import from broker
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/add-trade">
                <PlusCircle className="h-4 w-4 mr-2" /> Add trade
              </Link>
            </Button>
          </div>
        }
      />

      {needsReflectionCount > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setNeedsReflection((v) => !v)}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors " +
              (needsReflection
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground")
            }
          >
            Needs reflection
            <span className="tabular-nums">({needsReflectionCount})</span>
          </button>
          {needsReflection && (
            <button
              type="button"
              onClick={() => setNeedsReflection(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              clear
            </button>
          )}
        </div>
      )}

      <div className="surface-card p-3 md:p-4 mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={asset} onValueChange={(v) => setAsset(v as AssetFilter)}>
          <SelectTrigger className="md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assets</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="futures">Futures</SelectItem>
            <SelectItem value="options">Options</SelectItem>
          </SelectContent>
        </Select>
        <Select value={side} onValueChange={(v) => setSide(v as SideFilter)}>
          <SelectTrigger className="md:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Both sides</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
        <Select value={time} onValueChange={(v) => setTime(v as TimeFilter)}>
          <SelectTrigger className="md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest first</SelectItem>
            <SelectItem value="pnl">Highest P&L</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={data?.length === 0 ? "No trades logged yet" : "No matches"}
          description={
            data?.length === 0
              ? "Once you start journaling trades, they'll appear here."
              : "Try adjusting filters or search."
          }
          action={
            data?.length === 0 ? (
              <Button asChild size="sm">
                <Link to="/add-trade">
                  <PlusCircle className="h-4 w-4 mr-2" /> Add your first trade
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((t) => (
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

      <TradeDetailModal tradeId={activeId} onClose={() => setActiveId(null)} />
    </>
  );
}

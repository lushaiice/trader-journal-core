import { useState } from "react";
import { format } from "date-fns";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TradeForm } from "./trade-form";
import { PostTradeReview } from "./post-trade-review";
import { useTradeQuery, useDeleteTrade, type TradeWithRelations } from "@/lib/trades/api";
import { useScreenshotUrl } from "@/hooks/trades/use-screenshot-url";
import { EMOTIONAL_QUESTIONS } from "@/lib/trades/constants";
import {
  disciplineScore,
  formatINR,
  netPnl,
  rMultiple,
  type DisciplineRow,
  type ExitRow,
  type TradeRow,
} from "@/lib/trades/calculations";

interface Props {
  tradeId: string | null;
  onClose: () => void;
}

export function TradeDetailModal({ tradeId, onClose }: Props) {
  const { data, isLoading } = useTradeQuery(tradeId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useDeleteTrade();

  const open = !!tradeId;

  const handleDelete = async () => {
    if (!tradeId) return;
    try {
      await del.mutateAsync(tradeId);
      toast.success("Trade deleted");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error("Could not delete", { description: (err as Error).message });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {isLoading || !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : editing ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Trade</DialogTitle>
                <DialogDescription>Update any field and save your changes.</DialogDescription>
              </DialogHeader>
              <TradeForm
                initial={data}
                onSaved={() => {
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <DetailView
              data={data}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the trade, its exits, and its discipline log. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums mt-0.5 ${
          tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailView({
  data,
  onEdit,
  onDelete,
}: {
  data: TradeWithRelations;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { trade, exits, discipline } = data;
  const pnl = netPnl(trade, exits);
  const r = rMultiple(trade, exits);
  const ds = disciplineScore(discipline);
  const emotional: Record<string, number | null> = {
    confidence: trade.confidence,
    emotion_level: trade.emotion_level,
    recovery_urge: trade.recovery_urge,
    discipline_feel: trade.discipline_feel,
    setup_match: trade.setup_match,
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-xl">{trade.symbol}</DialogTitle>
            <DialogDescription>
              {format(new Date(trade.entry_date), "dd MMM yyyy · HH:mm")} ·{" "}
              <span className="capitalize">{trade.instrument_type}</span> ·{" "}
              <span className="capitalize">{trade.side}</span>
            </DialogDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <Stat label="Net P&L" value={formatINR(pnl)} tone={pnl >= 0 ? "good" : "bad"} />
        <Stat label="R Multiple" value={r !== null ? `${r.toFixed(2)}R` : "—"} />
        <Stat label="Discipline" value={ds !== null ? `${ds}%` : "—"} />
        <Stat label="Status" value={trade.status} />
      </div>

      <Separator className="my-4" />

      <PlannedVsActual trade={trade} exits={exits} />

      {exits.length > 0 && (
        <>
          <SectionLabel>Exits ({exits.length})</SectionLabel>
          <ExitsList exits={exits} />
        </>
      )}

      <SectionLabel>Costs</SectionLabel>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Brokerage" value={formatINR(Number(trade.brokerage))} />
        <Stat label="Taxes" value={formatINR(Number(trade.taxes))} />
        <Stat label="Other" value={formatINR(Number(trade.other_fees))} />
      </div>

      <SectionLabel>Emotional Check-in</SectionLabel>
      <div className="grid sm:grid-cols-2 gap-2">
        {EMOTIONAL_QUESTIONS.map((q) => {
          const v = emotional[q.key];
          return (
            <div
              key={q.key}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
            >
              <span className="text-xs">{q.label}</span>
              <span className="text-xs font-semibold text-primary">
                {v !== null && v !== undefined ? `${v}/5` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {discipline.length > 0 && (
        <>
          <SectionLabel>Discipline</SectionLabel>
          <ul className="grid sm:grid-cols-2 gap-2">
            {discipline.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <span>{d.rule}</span>
                <span className={d.followed ? "text-success" : "text-destructive"}>
                  {d.followed ? "Yes" : "No"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(trade.tags?.length ?? 0) > 0 && (
        <>
          <SectionLabel>Tags</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {trade.tags!.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        </>
      )}

      {trade.screenshot_url && <ScreenshotPreview stored={trade.screenshot_url} />}

      {trade.notes && (
        <>
          <SectionLabel>Notes</SectionLabel>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{trade.notes}</p>
        </>
      )}

      <SectionLabel>Post-trade review</SectionLabel>
      <PostTradeReview
        tradeId={trade.id}
        initialReview={(trade as TradeRow & { review_notes?: string | null }).review_notes}
        initialLessons={(trade as TradeRow & { lessons_learned?: string | null }).lessons_learned}
      />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground mt-5 mb-2">
      {children}
    </h4>
  );
}

function PlannedVsActual({ trade, exits }: { trade: TradeRow; exits: ExitRow[] }) {
  const filled = exits.reduce((a, e) => a + Number(e.quantity), 0) || 1;
  const avgExit =
    exits.length > 0
      ? exits.reduce((a, e) => a + Number(e.exit_price) * Number(e.quantity), 0) / filled
      : null;

  const rows: { label: string; planned: number | null; actual: number | string }[] = [
    { label: "Entry", planned: trade.planned_entry, actual: Number(trade.entry_price) },
    { label: "Stop Loss", planned: trade.planned_stop_loss, actual: trade.stop_loss ?? "—" },
    {
      label: "Target / Exit",
      planned: trade.planned_target,
      actual: avgExit !== null ? avgExit.toFixed(2) : "—",
    },
  ];

  return (
    <>
      <SectionLabel>Planned vs Actual</SectionLabel>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="grid grid-cols-3 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/30 px-3 py-2">
          <span />
          <span>Planned</span>
          <span>Actual</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-3 px-3 py-2 text-sm border-t border-border first:border-t-0"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular-nums">{r.planned ?? "—"}</span>
            <span className="tabular-nums">{r.actual}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ExitsList({ exits }: { exits: ExitRow[] }) {
  return (
    <ul className="space-y-2">
      {exits.map((e) => (
        <li
          key={e.id}
          className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium tabular-nums">
              {Number(e.quantity)} @ ₹{Number(e.exit_price).toFixed(2)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {format(new Date(e.exit_date), "dd MMM · HH:mm")}
            </p>
          </div>
          {e.notes && <p className="text-xs text-muted-foreground max-w-[50%] text-right">{e.notes}</p>}
        </li>
      ))}
    </ul>
  );
}

function ScreenshotPreview({ stored }: { stored: string }) {
  const url = useScreenshotUrl(stored);
  if (!url) return null;
  return (
    <>
      <SectionLabel>Chart Screenshot</SectionLabel>
      <img
        src={url}
        alt="Chart"
        className="rounded-lg border border-border w-full max-h-96 object-contain bg-black/40"
      />
    </>
  );
}

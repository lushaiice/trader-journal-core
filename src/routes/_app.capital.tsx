import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import {
  CapitalEventDialog,
  CapitalTimeline,
  PortfolioSnapshotCard,
} from "@/components/capital";
import {
  useCapitalState,
  useCreateCapitalEvent,
  useDeleteCapitalEvent,
  useUpdateCapitalEvent,
} from "@/hooks/capital";
import { usePortfolioAnalytics } from "@/hooks/analytics";
import {
  buildCapitalAdjustedEquityCurve,
  computeCapitalAdjustedReturn,
} from "@/lib/capital";
import type { CapitalEvent, CapitalEventInput } from "@/types/capital";

export const Route = createFileRoute("/_app/capital")({
  component: CapitalPage,
});

function CapitalPage() {
  const { isLoading, events, ledger, summary, baseCapital, hasInitialCapital } =
    useCapitalState();
  const create = useCreateCapitalEvent();
  const update = useUpdateCapitalEvent();
  const remove = useDeleteCapitalEvent();
  const analytics = usePortfolioAnalytics({ baseCapital });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CapitalEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Cashflow-aware curve to derive snapshot numbers.
  const pnlDays = analytics.equityCurve.map((p) => ({
    date: p.date,
    netPnl: p.dailyPnl,
    tradesClosed: p.tradesClosed,
  }));
  const adjustedCurve = buildCapitalAdjustedEquityCurve(pnlDays, events);
  const ret = computeCapitalAdjustedReturn(adjustedCurve);

  const isHistorical = (ev: CapitalEvent | null) => {
    if (!ev) return false;
    return new Date(`${ev.eventDate}T00:00:00Z`).getTime() <
      new Date().setHours(0, 0, 0, 0);
  };

  const handleSubmit = async (input: CapitalEventInput) => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, input });
    } else {
      await create.mutateAsync(input);
    }
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    await remove.mutateAsync(pendingDelete);
    setPendingDelete(null);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const ev = events.find((e) => e.id === id) ?? null;
    setEditing(ev);
    setDialogOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Capital"
        description="Track deposits, withdrawals, and your portfolio's true equity baseline."
        action={
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add event
          </Button>
        }
      />

      <div className="space-y-6">
        <PortfolioSnapshotCard
          summary={summary}
          endingEquity={baseCapital + ret.netTradingPnl}
          netTradingPnl={ret.netTradingPnl}
          capitalAdjustedReturn={ret.capitalAdjustedReturn}
        />

        <section className="surface-card p-4 md:p-5">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <h3 className="text-sm font-medium">Capital timeline</h3>
              <p className="text-[11px] text-muted-foreground">
                Every change to your trading capital. Sorted newest first.
              </p>
            </div>
            {!hasInitialCapital && !isLoading && (
              <Button size="sm" variant="ghost" onClick={openCreate}>
                Set starting capital
              </Button>
            )}
          </div>
          <CapitalTimeline
            ledger={ledger}
            onEdit={openEdit}
            onDelete={(id) => setPendingDelete(id)}
          />
        </section>

        <p className="text-[10px] text-muted-foreground text-center">
          Returns are adjusted for external capital flows. Deposits and withdrawals
          are excluded from performance calculations.
        </p>
      </div>

      <CapitalEventDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        hasInitial={hasInitialCapital}
        onSubmit={handleSubmit}
        isHistoricalEdit={isHistorical(editing)}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete capital event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will recalculate portfolio analytics and adjusted returns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

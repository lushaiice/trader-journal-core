import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const CONFIRM_TOKEN = "DELETE";

/**
 * Danger-zone action: wipe every trade this user owns. Also clears the
 * stored broker fills so a re-import doesn't rebuild the exact same book
 * from cache. Reflections, journals, capital events, and settings stay.
 *
 * Cascades: trades → trade_exits, discipline_logs, imported_trade_fills.
 */
async function clearAllTrades(userId: string): Promise<{ trades: number; fills: number }> {
  // Count first so we can report back to the user.
  const { count: tradeCount, error: countErr } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countErr) throw countErr;

  const { error: delTradesErr } = await supabase.from("trades").delete().eq("user_id", userId);
  if (delTradesErr) throw delTradesErr;

  // Wipe stored broker fills too so imports start clean.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fillsTable = (supabase as any).from("imported_fills");
  const { count: fillCount } = await fillsTable
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const { error: delFillsErr } = await fillsTable.delete().eq("user_id", userId);
  if (delFillsErr) throw delFillsErr;

  return { trades: tradeCount ?? 0, fills: fillCount ?? 0 };
}

export function ClearAllTradesSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      return clearAllTrades(user.id);
    },
    onSuccess: (r) => {
      toast.success(`Cleared ${r.trades} trades and ${r.fills} stored fills`);
      qc.invalidateQueries();
      setOpen(false);
      setConfirm("");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to clear trades");
    },
  });

  const canConfirm = confirm.trim().toUpperCase() === CONFIRM_TOKEN && !mut.isPending;

  return (
    <section className="surface-card p-6 space-y-4 border-destructive/30">
      <div>
        <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Danger zone
        </h3>
        <p className="text-xs text-muted-foreground">
          Clear every trade you&rsquo;ve logged or imported. Your reflections, journals, capital
          events, and settings are untouched.
        </p>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setConfirm("");
        }}
      >
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            Clear all trades
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all trades?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every trade, exit, and stored broker fill on your account.
              Reflections, journals, capital events, and settings stay. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{CONFIRM_TOKEN}</span> to confirm
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={CONFIRM_TOKEN}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canConfirm}
              onClick={(e) => {
                e.preventDefault();
                if (canConfirm) mut.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Clearing…
                </>
              ) : (
                "Clear all trades"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

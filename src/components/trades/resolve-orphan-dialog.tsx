import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Orphan } from "@/lib/import";
import { useAddCorporateAction, useAddHoldingBaseline } from "@/lib/import/adjustments-api";

interface Props {
  orphan: Orphan;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onResolved: () => void;
}

type ActionKind = "split" | "bonus" | "consolidation";

export function ResolveOrphanDialog({ orphan, open, onOpenChange, onResolved }: Props) {
  const [tab, setTab] = useState<"corp" | "hold">("corp");

  // Corporate action fields
  const [actionKind, setActionKind] = useState<ActionKind>("split");
  const [n, setN] = useState("1");
  const [m, setM] = useState("1");
  const [exDate, setExDate] = useState("");

  // Holding baseline fields
  const [avgCost, setAvgCost] = useState("");
  const [asOfDate, setAsOfDate] = useState("");

  const addAction = useAddCorporateAction();
  const addBaseline = useAddHoldingBaseline();
  const busy = addAction.isPending || addBaseline.isPending;

  const helperLabel: Record<ActionKind, [string, string]> = {
    split: ["New shares (N)", "Old shares (M)"],
    bonus: ["Bonus shares (N)", "Held shares (M)"],
    consolidation: ["New shares (N)", "Old shares (M)"],
  };

  const saveCorp = async () => {
    const nn = Number(n);
    const mm = Number(m);
    if (!(nn > 0) || !(mm > 0)) {
      toast.error("Ratio numbers must be positive.");
      return;
    }
    if (!exDate) {
      toast.error("Please pick an ex-date.");
      return;
    }
    // For bonus: stored ratio_from=M, ratio_to=N+M => factor = (N+M)/M.
    const ratio_from = mm;
    const ratio_to = actionKind === "bonus" ? nn + mm : nn;
    try {
      await addAction.mutateAsync({
        isin: null,
        symbol: orphan.symbol,
        action_type: actionKind,
        ex_date: exDate,
        ratio_from,
        ratio_to,
      });
      toast.success("Saved — we'll remember this for future imports.");
      onResolved();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't save", { description: (err as Error).message });
    }
  };

  const saveHold = async () => {
    const cost = Number(avgCost);
    if (!(cost > 0)) {
      toast.error("Enter a valid average buy price.");
      return;
    }
    try {
      await addBaseline.mutateAsync({
        isin: null,
        symbol: orphan.symbol,
        avg_cost: cost,
        quantity: orphan.quantity,
        as_of_date: asOfDate || null,
      });
      toast.success("Saved — this holding will be applied automatically.");
      onResolved();
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't save", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve {orphan.symbol}</DialogTitle>
          <DialogDescription>
            Sell of {orphan.quantity} @ {orphan.price.toFixed(2)} has no matching buy in this
            file. Tell us why so future imports get it right.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "corp" | "hold")}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="corp">Corporate action</TabsTrigger>
            <TabsTrigger value="hold">Existing holding</TabsTrigger>
          </TabsList>

          <TabsContent value="corp" className="space-y-3 pt-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={actionKind} onValueChange={(v) => setActionKind(v as ActionKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="split">Split</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="consolidation">Consolidation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>{helperLabel[actionKind][0]}</Label>
                <Input value={n} inputMode="numeric" onChange={(e) => setN(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>{helperLabel[actionKind][1]}</Label>
                <Input value={m} inputMode="numeric" onChange={(e) => setM(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Ex-date</Label>
              <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              We&rsquo;ll normalize pre-event fills to the current share basis. This resolution is
              saved and applied to future imports too.
            </p>
          </TabsContent>

          <TabsContent value="hold" className="space-y-3 pt-3">
            <div className="grid gap-2">
              <Label>Average buy price</Label>
              <Input
                value={avgCost}
                inputMode="decimal"
                onChange={(e) => setAvgCost(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Acquisition date (optional)</Label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This tells us the position was bought before your export window. Saved for future
              imports too.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={tab === "corp" ? saveCorp : saveHold} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Save resolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

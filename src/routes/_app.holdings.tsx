import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";
import {
  loadOpeningPositions,
  upsertOpeningPosition,
  deleteOpeningPosition,
  loadCorporateActions,
  upsertCorporateAction,
  deleteCorporateAction,
} from "@/lib/trades/import/holdings-api";

export const Route = createFileRoute("/_app/holdings")({
  component: () => (
    <SectionErrorBoundary
      title="Holdings is temporarily unavailable."
      description="Try again in a moment."
    >
      <HoldingsPage />
    </SectionErrorBoundary>
  ),
});

function HoldingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="Holdings & Adjustments"
        description="Pre-import opening positions and corporate actions used when reconstructing P&L from broker imports."
      />
      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertTitle>Why this matters</AlertTitle>
        <AlertDescription>
          Anything bought before your first imported tradebook has no cost basis, so a later sell
          gets dropped as an orphan. Splits and bonuses change the broker's lot quantity but the
          original buy still reports pre-split units. Add both here, then re-import.
        </AlertDescription>
      </Alert>
      <OpeningPositionsSection userId={user.id} />
      <div className="h-6" />
      <CorporateActionsSection userId={user.id} />
    </>
  );
}

function OpeningPositionsSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["opening_positions", userId],
    queryFn: () => loadOpeningPositions(userId),
  });

  const [form, setForm] = useState({
    symbol: "",
    quantity: "",
    avgCost: "",
    acquisitionDate: "",
  });

  const add = useMutation({
    mutationFn: async () => {
      const symbol = form.symbol.trim().toUpperCase();
      const quantity = Number(form.quantity);
      const avgCost = Number(form.avgCost);
      if (!symbol || !quantity || avgCost < 0 || !form.acquisitionDate) {
        throw new Error("Fill in all fields");
      }
      await upsertOpeningPosition(userId, {
        symbol,
        side: "long",
        quantity,
        avgCost,
        acquisitionDate: form.acquisitionDate,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opening_positions", userId] });
      setForm({ symbol: "", quantity: "", avgCost: "", acquisitionDate: "" });
      toast.success("Opening position saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: deleteOpeningPosition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opening_positions", userId] });
    },
  });

  return (
    <section className="surface-card p-4">
      <h2 className="text-base font-semibold mb-1">Opening positions</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Long holdings present before your first imported tradebook.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <div>
          <Label className="text-xs">Symbol</Label>
          <Input
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="MCX"
          />
        </div>
        <div>
          <Label className="text-xs">Quantity</Label>
          <Input
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Avg cost</Label>
          <Input
            type="number"
            step="0.01"
            value={form.avgCost}
            onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Acquired on</Label>
          <Input
            type="date"
            value={form.acquisitionDate}
            onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="w-full"
          >
            {add.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No opening positions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg cost</TableHead>
              <TableHead>Acquired</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.symbol}</TableCell>
                <TableCell className="text-right">{r.quantity}</TableCell>
                <TableCell className="text-right">{r.avgCost.toFixed(2)}</TableCell>
                <TableCell>{r.acquisitionDate}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => del.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function CorporateActionsSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["corporate_actions", userId],
    queryFn: () => loadCorporateActions(userId),
  });

  const [form, setForm] = useState({
    symbol: "",
    exDate: "",
    actionType: "split" as "split" | "bonus" | "consolidation",
    ratioFrom: "1",
    ratioTo: "2",
  });

  const add = useMutation({
    mutationFn: async () => {
      const symbol = form.symbol.trim().toUpperCase();
      const ratioFrom = Number(form.ratioFrom);
      const ratioTo = Number(form.ratioTo);
      if (!symbol || !form.exDate || !ratioFrom || !ratioTo) {
        throw new Error("Fill in all fields");
      }
      await upsertCorporateAction(userId, {
        symbol,
        exDate: form.exDate,
        actionType: form.actionType,
        ratioFrom,
        ratioTo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corporate_actions", userId] });
      setForm({ symbol: "", exDate: "", actionType: "split", ratioFrom: "1", ratioTo: "2" });
      toast.success("Corporate action saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: deleteCorporateAction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["corporate_actions", userId] });
    },
  });

  return (
    <section className="surface-card p-4">
      <h2 className="text-base font-semibold mb-1">Corporate actions</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Splits (1:2), bonuses (1:1), consolidations (5:1). Ratio is from → to.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
        <div>
          <Label className="text-xs">Symbol</Label>
          <Input
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="TATAINVEST"
          />
        </div>
        <div>
          <Label className="text-xs">Ex date</Label>
          <Input
            type="date"
            value={form.exDate}
            onChange={(e) => setForm({ ...form, exDate: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select
            value={form.actionType}
            onValueChange={(v) =>
              setForm({ ...form, actionType: v as typeof form.actionType })
            }
          >
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
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="number"
            value={form.ratioFrom}
            onChange={(e) => setForm({ ...form, ratioFrom: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="number"
            value={form.ratioTo}
            onChange={(e) => setForm({ ...form, ratioTo: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            onClick={() => add.mutate()}
            disabled={add.isPending}
            className="w-full"
          >
            {add.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No corporate actions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Ex date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Ratio</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.symbol}</TableCell>
                <TableCell>{r.exDate}</TableCell>
                <TableCell className="capitalize">{r.actionType}</TableCell>
                <TableCell className="text-right">
                  {r.ratioFrom} : {r.ratioTo}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => del.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, AlertTriangle, Info, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { importZerodhaTradebook, parseZerodhaTradebook } from "@/lib/trades/import";
import {
  loadExistingFillIds,
  persistImportedTrades,
  type PersistSummary,
} from "@/lib/trades/import/persist";
import {
  classifyWithContinuation,
  loadOpenTrades,
  type ClassifiedTradeC3,
} from "@/lib/trades/import/continuation";
import type { ImportResult } from "@/lib/trades/import/types";
import { GrossPnlBadge } from "@/components/trades/gross-pnl-badge";
import { formatINR } from "@/lib/trades/calculations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/import")({
  component: () => (
    <SectionErrorBoundary
      title="Import is temporarily unavailable."
      description="Your existing trades are safe. Try again in a moment."
    >
      <ImportPage />
    </SectionErrorBoundary>
  ),
});


interface PreviewState {
  result: ImportResult;
  classified: ClassifiedTradeC3[];
  selected: Set<number>;
  fileName: string;
}

function grossPnl(t: ClassifiedTradeC3["trade"]): number {
  const sign = t.side === "long" ? 1 : -1;
  return t.exits.reduce(
    (acc, e) => acc + (e.exit_price - t.entry_price) * e.quantity * sign,
    0,
  );
}

function ImportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [summary, setSummary] = useState<PersistSummary | null>(null);

  const handleFile = async (file: File) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setBusy(true);
    setSummary(null);
    try {
      const text = await file.text();
      const result = importZerodhaTradebook(text);
      const parsed = parseZerodhaTradebook(text);
      const [existing, openTrades] = await Promise.all([
        loadExistingFillIds(user.id),
        loadOpenTrades(user.id),
      ]);
      const warningsSink = [...result.warnings];
      const { items } = classifyWithContinuation(
        parsed.fills,
        result.trades,
        existing,
        openTrades,
        warningsSink,
      );
      const enrichedResult: ImportResult = {
        ...result,
        warnings: warningsSink,
      };
      const selected = new Set<number>();
      items.forEach((c, i) => {
        if (c.classification === "new" || c.classification === "continuation") {
          selected.add(i);
        }
      });
      setPreview({ result: enrichedResult, classified: items, selected, fileName: file.name });
    } catch (err) {
      toast.error("Could not read file", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const confirm = useMutation({
    mutationFn: async () => {
      if (!preview || !user) throw new Error("No preview");
      const actionable: ClassifiedTradeC3[] = preview.classified.map((c, i) => {
        const importable =
          c.classification === "new" || c.classification === "continuation";
        if (importable && !preview.selected.has(i)) {
          // demote unchecked importables to overlap so they're flagged not inserted
          return { ...c, classification: "overlap" as const };
        }
        return c;
      });
      const s = await persistImportedTrades(actionable, user.id);
      return s;
    },
    onSuccess: (s) => {
      setSummary(s);
      qc.invalidateQueries({ queryKey: ["trades"] });
      const total = s.imported + s.continued;
      toast.success(
        `Imported ${s.imported} new + ${s.continued} continued (${total} total)`,
      );
    },
    onError: (err) => {
      toast.error("Import failed", { description: (err as Error).message });

    },
  });

  const reset = () => {
    setPreview(null);
    setSummary(null);
  };

  return (
    <>
      <PageHeader
        title="Import from broker"
        description="Upload a Zerodha Console tradebook CSV. Trades are reconstructed in your browser — the file never leaves this device."
      />

      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertTitle>P&amp;L shown is GROSS</AlertTitle>
        <AlertDescription>
          Zerodha's tradebook does not include brokerage or taxes. Add charges per trade after
          import to see net figures.
        </AlertDescription>
      </Alert>

      {!preview && !summary && (
        <div className="surface-card p-8 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-medium mb-1">Select a tradebook CSV</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Console → Reports → Tradebook → Download (CSV).
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <Button asChild size="sm" disabled={busy}>
              <span>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Choose CSV file
              </span>
            </Button>
          </label>
        </div>
      )}

      {preview && !summary && (
        <PreviewView
          preview={preview}
          onToggle={(i) => {
            const next = new Set(preview.selected);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            setPreview({ ...preview, selected: next });
          }}
          onCancel={reset}
          onConfirm={() => confirm.mutate()}
          busy={confirm.isPending}
        />
      )}

      {summary && (
        <SummaryView summary={summary} onDone={reset} />
      )}
    </>
  );
}

function PreviewView({
  preview,
  onToggle,
  onCancel,
  onConfirm,
  busy,
}: {
  preview: PreviewState;
  onToggle: (i: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const counts = preview.classified.reduce(
    (acc, c) => {
      acc[c.classification] = (acc[c.classification] ?? 0) + 1;
      return acc;
    },
    { new: 0, duplicate: 0, overlap: 0, continuation: 0, ambiguous: 0 } as Record<string, number>,
  );

  const selectedCount = preview.selected.size;

  return (
    <>
      <div className="surface-card p-4 mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{preview.fileName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{preview.result.stats.rowsParsed} rows</span>
          <span>·</span>
          <span>{preview.classified.length} trades</span>
          <span>·</span>
          <Badge variant="secondary">{counts.new} new</Badge>
          {counts.continuation > 0 && (
            <Badge variant="secondary">{counts.continuation} continues open</Badge>
          )}
          <Badge variant="outline">{counts.duplicate} duplicate</Badge>
          <Badge variant="outline">{counts.overlap} overlap</Badge>
          {counts.ambiguous > 0 && (
            <Badge variant="outline">{counts.ambiguous} ambiguous</Badge>
          )}

        </div>
      </div>

      {preview.result.warnings.length > 0 && (
        <Alert className="mb-3" variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {preview.result.warnings.length} warning
            {preview.result.warnings.length === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
              {preview.result.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>
                  <span className="font-mono text-[10px] uppercase mr-1">{w.code}</span>
                  {w.symbol ? `${w.symbol}: ` : ""}
                  {w.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="surface-card overflow-x-auto mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Avg Exit</TableHead>
              <TableHead className="text-right">Gross P&amp;L</TableHead>
              <TableHead>Class</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.classified.map((c, i) => {
              const t = c.trade;
              const exitQty = t.exits.reduce((a, e) => a + e.quantity, 0);
              const avgExit =
                exitQty > 0
                  ? t.exits.reduce((a, e) => a + e.exit_price * e.quantity, 0) / exitQty
                  : null;
              const pnl = grossPnl(t);
              const importable =
                c.classification === "new" || c.classification === "continuation";

              return (
                <TableRow
                  key={i}
                  className={cn(!importable && "opacity-60")}
                >
                  <TableCell>
                    <Checkbox
                      checked={preview.selected.has(i)}
                      disabled={!importable}
                      onCheckedChange={() => onToggle(i)}
                      aria-label={`Select ${t.symbol}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{t.symbol}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {t.instrument_type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{t.side}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{t.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {t.entry_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {avgExit !== null ? avgExit.toFixed(2) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums text-sm",
                      avgExit !== null && (pnl >= 0 ? "text-success" : "text-destructive"),
                    )}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {avgExit !== null ? formatINR(pnl) : "—"}
                      <GrossPnlBadge source="csv_import" brokerage={0} taxes={0} other_fees={0} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <ClassChip cls={c.classification} />
                      {c.continuationSummary && (
                        <span className="text-[10px] text-muted-foreground">
                          {c.continuationSummary}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {counts.overlap > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          Overlap trades share fills with a previous import — complete them manually.
        </p>
      )}
      {counts.ambiguous > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          Ambiguous trades match more than one open trade (or a manual open) for the symbol —
          complete them manually.
        </p>
      )}


      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={busy || selectedCount === 0}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Import {selectedCount} trade{selectedCount === 1 ? "" : "s"}
        </Button>
      </div>
    </>
  );
}

function ClassChip({ cls }: { cls: "new" | "duplicate" | "overlap" }) {
  if (cls === "new") return <Badge variant="secondary" className="text-[10px]">New</Badge>;
  if (cls === "duplicate")
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Duplicate
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600/40">
      Overlap
    </Badge>
  );
}

function SummaryView({ summary, onDone }: { summary: PersistSummary; onDone: () => void }) {
  return (
    <div className="surface-card p-6">
      <h3 className="text-sm font-medium mb-3">Import complete</h3>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Row label="Imported" value={summary.imported} />
        <Row label="Skipped (duplicate)" value={summary.skippedDuplicate} />
        <Row label="Flagged (overlap)" value={summary.flaggedOverlap} />
        <Row label="Failed" value={summary.failed} tone={summary.failed > 0 ? "bad" : undefined} />
      </dl>
      {summary.errors.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-destructive">
          {summary.errors.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.symbol}:</span> {e.message}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex justify-end">
        <Button size="sm" variant="outline" onClick={onDone}>
          Import another file
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "bad";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums mt-0.5",
          tone === "bad" ? "text-destructive" : "",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

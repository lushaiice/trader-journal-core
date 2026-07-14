import { useRef, useState, type DragEvent } from "react";
import { format } from "date-fns";
import { FileUp, Loader2, Upload, X, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reconstructFromCsv } from "@/lib/import";
import type { ReconstructionResult } from "@/lib/import";
import { useImportTrades } from "@/lib/import/persist";
import { formatINR } from "@/lib/trades/calculations";
import { computeBatchCharges } from "@/lib/charges/engine";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Stage = "upload" | "preview";

interface Preview extends ReconstructionResult {
  variant: "equity" | "fo";
  fillCount: number;
  skippedRows: { rowNumber: number; reason: string }[];
}

export function ImportTradesDialog({ open, onOpenChange }: Props) {
  const [stage, setStage] = useState<Stage>("upload");
  const [drag, setDrag] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importMut = useImportTrades();

  const reset = () => {
    setStage("upload");
    setPreview(null);
    setError(null);
    setDrag(false);
    setParsing(false);
    importMut.reset();
  };

  const handleFile = async (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name)) {
      setError("Please choose a .csv file.");
      return;
    }
    setParsing(true);
    try {
      const text = await file.text();
      const result = reconstructFromCsv(text);
      setPreview(result);
      setStage("preview");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const confirmImport = async () => {
    if (!preview) return;
    try {
      const outcome = await importMut.mutateAsync(preview.trades);
      const parts = [
        outcome.imported ? `${outcome.imported} imported` : null,
        outcome.skipped ? `${outcome.skipped} already imported` : null,
      ].filter(Boolean);
      toast.success(parts.join(" · ") || "Nothing new to import");
      onOpenChange(false);
      // Delay reset so closing animation is clean.
      setTimeout(reset, 200);
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    }
  };

  const closedCount = preview?.trades.filter((t) => t.kind === "closed").length ?? 0;
  const openCount = preview?.trades.filter((t) => t.kind === "open").length ?? 0;
  const orphanCount = preview?.orphans.length ?? 0;
  const skippedCount = preview?.skippedRows.length ?? 0;
  const totalPnl = preview?.trades.reduce((a, t) => a + t.gross_pnl, 0) ?? 0;
  const chargesBatch = preview ? computeBatchCharges(preview.trades) : null;
  const totalCharges = chargesBatch?.total ?? 0;
  const netPnl = totalPnl - totalCharges;

  const dateRange = (() => {
    if (!preview || preview.trades.length + preview.orphans.length === 0) return null;
    const dates = [
      ...preview.trades.map((t) => t.entry_date),
      ...preview.trades.flatMap((t) => t.exits.map((e) => e.exit_date)),
      ...preview.orphans.map((o) => o.execution_time),
    ].sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Zerodha</DialogTitle>
          <DialogDescription>
            Upload a Zerodha Console Tradebook CSV. We&rsquo;ll reconstruct your fills into
            round-trip trades. Fills already imported are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {stage === "upload" && (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 cursor-pointer transition-colors ${
                drag
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 bg-muted/20"
              }`}
            >
              {parsing ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <FileUp className="h-5 w-5 text-muted-foreground" />
              )}
              <p className="text-sm text-muted-foreground">
                {parsing ? "Reading file…" : "Drop tradebook CSV or click to browse"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Equity or F&amp;O · exported from Zerodha Console
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            {error && (
              <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">A few things to know:</p>
              <p>
                · Charges (brokerage, STT, exchange, SEBI, stamp, GST) are{" "}
                <span className="text-foreground">estimated</span> from published Zerodha rates —
                accurate within a rupee or two of the calculator.
              </p>
              <p>
                · Closing fills whose opening trade is outside the export window are skipped and
                listed for review.
              </p>
              <p>
                · Export a wider date range so entries and exits both fall inside the file for
                cleanest reconstruction.
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Don&rsquo;t have a supported broker account yet?{" "}
              <a
                href="https://zerodha.com/open-account?c=ZMPUWK"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get set up &rarr;
              </a>
            </p>
          </div>
        )}

        {stage === "preview" && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <SummaryStat label="Closed" value={String(closedCount)} />
              <SummaryStat label="Open" value={String(openCount)} />
              <SummaryStat label="Gross P&L" value={formatINR(totalPnl)} tone={totalPnl >= 0 ? "pos" : "neg"} />
              <SummaryStat
                label="Net P&L"
                value={formatINR(netPnl)}
                tone={netPnl >= 0 ? "pos" : "neg"}
              />
            </div>
            <div className="text-xs text-muted-foreground -mt-2">
              Estimated charges applied: {formatINR(totalCharges)} (brokerage, STT, exchange,
              SEBI, stamp, GST). Values match Zerodha&rsquo;s calculator within a small tolerance
              — actual contract-note figures may differ by a rupee or two.
            </div>

            {dateRange && (
              <div className="text-xs text-muted-foreground">
                {preview.fillCount} fills · {preview.variant === "fo" ? "F&O" : "Equity"} ·{" "}
                {fmtDate(dateRange.from)} → {fmtDate(dateRange.to)}
                {preview.fillCount > 50000 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    (large file — reconstruction may take a few seconds)
                  </span>
                )}
              </div>
            )}

            {preview.trades.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Gross P&amp;L</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.trades.slice(0, 200).map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.symbol}</TableCell>
                        <TableCell className="capitalize">{t.side}</TableCell>
                        <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t.entry_price.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            t.kind === "open"
                              ? "text-muted-foreground"
                              : t.gross_pnl >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                          }`}
                        >
                          {t.kind === "open" && t.exits.length === 0 ? "—" : formatINR(t.gross_pnl)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.kind === "closed" ? "secondary" : "outline"}>
                            {t.kind}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.trades.length > 200 && (
                  <p className="text-xs text-muted-foreground p-2 text-center border-t border-border">
                    Showing first 200 of {preview.trades.length} trades.
                  </p>
                )}
              </div>
            )}

            {preview.trades.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No reconstructable trades in this file.
              </div>
            )}

            {orphanCount > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="orphans" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm">
                    {orphanCount} row{orphanCount === 1 ? "" : "s"} we couldn&rsquo;t reconstruct
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground mb-2">
                      These closing fills have no matching opening trade in this file. Usually the
                      position was opened before your export window — re-exporting with an earlier
                      start date will capture it. It can also happen with bonus, split, or demerger
                      shares, which have no buy fill to match. These rows were skipped; log them
                      manually if you want them tracked.
                    </p>
                    <div className="space-y-1.5">
                      {preview.orphans.slice(0, 50).map((o, i) => (
                        <div
                          key={i}
                          className="flex justify-between text-xs bg-muted/40 rounded px-2 py-1.5"
                        >
                          <span className="font-medium">{o.symbol}</span>
                          <span className="text-muted-foreground">
                            {o.side} {o.quantity} @ {o.price.toFixed(2)} ·{" "}
                            {fmtDate(o.execution_time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {skippedCount > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="skipped" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm">
                    {skippedCount} row{skippedCount === 1 ? "" : "s"} skipped (unreadable) ·{" "}
                    {preview.trades.length} trade{preview.trades.length === 1 ? "" : "s"}{" "}
                    reconstructed
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground mb-2">
                      A few rows couldn&rsquo;t be parsed — usually a truncated final row from an
                      interrupted download. The rest of the file imported fine.
                    </p>
                    <div className="space-y-1.5">
                      {preview.skippedRows.slice(0, 50).map((s, i) => (
                        <div
                          key={i}
                          className="flex justify-between gap-3 text-xs bg-muted/40 rounded px-2 py-1.5"
                        >
                          <span className="font-medium shrink-0">Row {s.rowNumber}</span>
                          <span className="text-muted-foreground text-right truncate">
                            {s.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {stage === "preview" ? (
            <>
              <Button variant="ghost" onClick={reset} disabled={importMut.isPending}>
                <X className="h-4 w-4 mr-1" /> Choose another file
              </Button>
              <Button
                onClick={confirmImport}
                disabled={importMut.isPending || preview!.trades.length === 0}
              >
                {importMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" /> Import {preview!.trades.length} trade
                    {preview!.trades.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  muted?: boolean;
}) {
  const color =
    tone === "pos"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "neg"
        ? "text-destructive"
        : muted
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

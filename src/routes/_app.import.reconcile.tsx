import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileText, TrendingUp, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTradesQuery } from "@/lib/trades/api";
import { normalizeTrades } from "@/lib/analytics/normalize";
import {
  parseBrokerPnlReport,
  type BrokerPnlReport,
} from "@/lib/trades/import/zerodha-pnl";
import { formatINR } from "@/lib/trades/calculations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/import/reconcile")({
  component: () => (
    <SectionErrorBoundary
      title="Reconciliation is temporarily unavailable."
      description="Your trades are safe."
    >
      <ReconcilePage />
    </SectionErrorBoundary>
  ),
});

interface Row {
  symbol: string;
  brokerPnl: number | null;
  appPnl: number;
  diff: number;
  likelyCause: string;
}

const TOLERANCE = 0.5; // ₹

function ReconcilePage() {
  const [report, setReport] = useState<BrokerPnlReport | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const { data: trades = [], isLoading } = useTradesQuery();

  const appPnlBySymbol = useMemo(() => {
    const normalized = normalizeTrades(trades);
    const map = new Map<string, number>();
    for (const t of normalized) {
      // realized only — open trades contribute 0 (broker reports realized too)
      if (t.status !== "closed" && t.status !== "partial") continue;
      const prior = map.get(t.symbol) ?? 0;
      map.set(t.symbol, prior + t.netPnl);
    }
    return map;
  }, [trades]);

  const rows: Row[] = useMemo(() => {
    if (!report) return [];
    const symbols = new Set<string>([
      ...report.bySymbol.keys(),
      ...appPnlBySymbol.keys(),
    ]);
    const out: Row[] = [];
    for (const symbol of symbols) {
      const broker = report.bySymbol.get(symbol);
      const brokerPnl = broker?.realizedPnl ?? null;
      const appPnl = appPnlBySymbol.get(symbol) ?? 0;
      const diff = brokerPnl === null ? appPnl : appPnl - brokerPnl;
      const brokerCharges = broker?.charges ?? null;

      let likelyCause = "match";
      if (brokerPnl === null) {
        likelyCause = "in app, not in broker file";
      } else if (Math.abs(diff) <= TOLERANCE) {
        likelyCause = "✓ within ₹0.50";
      } else if (appPnl === 0 && Math.abs(brokerPnl) > TOLERANCE) {
        likelyCause = "in broker, missing from app (orphan sell? earlier window?)";
      } else if (
        brokerCharges !== null &&
        Math.abs(Math.abs(diff) - brokerCharges) <= Math.max(brokerCharges * 0.1, 1)
      ) {
        likelyCause = "charges not imported (≈ broker charges)";
      } else if (Math.sign(appPnl) !== Math.sign(brokerPnl) && appPnl !== 0) {
        likelyCause = "sign mismatch — investigate side/flip";
      } else {
        likelyCause = "investigate";
      }

      out.push({ symbol, brokerPnl, appPnl, diff, likelyCause });
    }
    return out.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [report, appPnlBySymbol]);

  const totals = useMemo(() => {
    if (!report) return null;
    const broker = rows.reduce((a, r) => a + (r.brokerPnl ?? 0), 0);
    const app = rows.reduce((a, r) => a + r.appPnl, 0);
    return { broker, app, diff: app - broker };
  }, [rows, report]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const r = parseBrokerPnlReport(text);
    setReport(r);
    setFileName(file.name);
  };

  return (
    <>
      <PageHeader
        title="Reconcile against broker P&L"
        description="Compare per-symbol realized P&L between this app and a Zerodha Console P&L report to spot what's missing."
      />

      {!report && (
        <div className="surface-card p-8 text-center">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-medium mb-1">Upload broker P&L CSV</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Console → Reports → P&L (Equity / F&O) → Download CSV. The file stays in your browser.
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
            <Button asChild size="sm">
              <span>Choose P&L file</span>
            </Button>
          </label>
        </div>
      )}

      {report && (
        <>
          <div className="surface-card p-4 mb-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{fileName}</span>
              <Badge variant="outline" className="text-[10px]">
                {report.totals.symbols} symbols
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setReport(null);
                setFileName(null);
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          </div>

          {report.warnings.length > 0 && (
            <Alert className="mb-3">
              <AlertTitle>Parser notes</AlertTitle>
              <AlertDescription className="text-xs">
                {report.warnings.join("; ")}
                {report.columnsDetected.length > 0 && (
                  <div className="mt-1 text-muted-foreground font-mono">
                    Detected: {report.columnsDetected.join(" · ")}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {totals && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="Broker total" value={formatINR(totals.broker)} />
              <Stat label="App total" value={formatINR(totals.app)} />
              <Stat
                label="Difference"
                value={formatINR(totals.diff)}
                tone={Math.abs(totals.diff) > TOLERANCE ? "warn" : "ok"}
              />
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading trades…</p>
          ) : (
            <div className="surface-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Broker</TableHead>
                    <TableHead className="text-right">App</TableHead>
                    <TableHead className="text-right">Diff</TableHead>
                    <TableHead>Likely cause</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.symbol}>
                      <TableCell className="font-medium text-sm">{r.symbol}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {r.brokerPnl === null ? "—" : formatINR(r.brokerPnl)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatINR(r.appPnl)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums text-sm",
                          Math.abs(r.diff) <= TOLERANCE
                            ? "text-muted-foreground"
                            : r.diff > 0
                              ? "text-success"
                              : "text-destructive",
                        )}
                      >
                        {formatINR(r.diff)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.likelyCause}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Alert className="mt-4">
            <TrendingUp className="h-4 w-4" />
            <AlertTitle>What to do with the diffs</AlertTitle>
            <AlertDescription className="text-xs">
              <ul className="mt-2 space-y-1">
                <li>
                  <strong>"charges not imported"</strong> → re-run <a className="underline" href="/import">/import</a>
                  {" "}with the P&L CSV attached as Step 2; charges will be allocated automatically.
                </li>
                <li>
                  <strong>"in broker, missing from app"</strong> → likely a pre-existing
                  holding closed during the import window. Add the original buy manually from
                  Add Trade, or include an earlier tradebook.
                </li>
                <li>
                  <strong>"sign mismatch"</strong> → inspect the trade on /trades; usually a
                  long/short interpretation issue worth raising via feedback.
                </li>
              </ul>
            </AlertDescription>
          </Alert>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums mt-0.5",
          tone === "warn" && "text-amber-600",
          tone === "ok" && "text-success",
        )}
      >
        {value}
      </div>
    </div>
  );
}

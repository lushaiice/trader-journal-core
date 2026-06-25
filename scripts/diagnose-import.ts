/**
 * Dev-only diagnostic for CSV import reconstruction.
 * Run: bunx tsx scripts/diagnose-import.ts <path-to-csv>
 */
import { readFileSync } from "node:fs";
import { parseZerodhaTradebook } from "../src/lib/trades/import/zerodha";
import { aggregateFills } from "../src/lib/trades/import/aggregate";

const path = process.argv[2];
if (!path) {
  console.error("usage: diagnose-import.ts <csv>");
  process.exit(1);
}
const csv = readFileSync(path, "utf8");
const parsed = parseZerodhaTradebook(csv);
const agg = aggregateFills(parsed.fills);

console.log(`rowsParsed=${parsed.rowsParsed} rowsSkipped=${parsed.rowsSkipped} fills=${parsed.fills.length} trades=${agg.trades.length}`);
console.log(`parse warnings: ${parsed.warnings.length}, agg warnings: ${agg.warnings.length}`);

interface Row {
  symbol: string;
  buy: number;
  sell: number;
  net: number;
  trades: number;
  statuses: string[];
}

const fillsBySym = new Map<string, typeof parsed.fills>();
for (const f of parsed.fills) {
  if (!fillsBySym.has(f.symbol)) fillsBySym.set(f.symbol, []);
  fillsBySym.get(f.symbol)!.push(f);
}

const tradesBySym = new Map<string, typeof agg.trades>();
for (const t of agg.trades) {
  if (!tradesBySym.has(t.symbol)) tradesBySym.set(t.symbol, []);
  tradesBySym.get(t.symbol)!.push(t);
}

const rows: Row[] = [];
for (const [sym, fs] of fillsBySym) {
  let buy = 0, sell = 0;
  for (const f of fs) {
    if (f.side === "buy") buy += f.quantity;
    else sell += f.quantity;
  }
  const ts = tradesBySym.get(sym) ?? [];
  rows.push({
    symbol: sym,
    buy,
    sell,
    net: buy - sell,
    trades: ts.length,
    statuses: ts.map((t) => t.status),
  });
}

rows.sort((a, b) => a.symbol.localeCompare(b.symbol));

console.log("\n=== Per-symbol summary ===");
console.log("symbol            buy_qty   sell_qty   net   #trades  statuses");
for (const r of rows) {
  console.log(
    r.symbol.padEnd(16) +
      " " + String(r.buy).padStart(8) +
      " " + String(r.sell).padStart(10) +
      " " + String(r.net).padStart(6) +
      " " + String(r.trades).padStart(6) +
      "   " + r.statuses.join(","),
  );
}

const broken = rows.filter(
  (r) => Math.abs(r.net) < 1e-6 && r.statuses.some((s) => s !== "closed"),
);

console.log(`\n=== BROKEN symbols (net=0 but open/partial trades): ${broken.length} ===`);
for (const r of broken) console.log(`  ${r.symbol}  trades=${r.trades}  statuses=[${r.statuses.join(",")}]  buy=${r.buy} sell=${r.sell}`);

if (broken.length > 0) {
  const target = broken[0].symbol;
  console.log(`\n=== Ordered fills for one broken symbol: ${target} ===`);
  const fs = (fillsBySym.get(target) ?? []).slice().sort((a, b) => {
    const dt = a.executedAt.getTime() - b.executedAt.getTime();
    if (dt !== 0) return dt;
    return a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0;
  });
  let running = 0;
  for (const f of fs) {
    const s = f.side === "buy" ? f.quantity : -f.quantity;
    running += s;
    console.log(
      `  ${f.executedAt.toISOString()}  ${f.side.padEnd(4)}  qty=${String(f.quantity).padStart(6)}  px=${f.price}  exch=${f.exchange}/${f.segment}/${f.series}  oid=${f.orderId}  tid=${f.tradeId}  running=${running}`,
    );
  }

  const ts = tradesBySym.get(target) ?? [];
  console.log(`\n=== Engine grouping for ${target}: ${ts.length} trade(s) ===`);
  ts.forEach((t, i) => {
    console.log(
      `  trade[${i}] side=${t.side} status=${t.status} entry=${t.entry_price} qty=${t.quantity} entry_date=${t.entry_date} fillTradeIds=[${t.fillTradeIds.join(",")}] exits=${t.exits.length}`,
    );
    for (const e of t.exits) {
      console.log(`     exit qty=${e.quantity} px=${e.exit_price} date=${e.exit_date}`);
    }
  });
}

// also: do any fills share symbol but differ on exchange/segment/series?
console.log("\n=== Symbols spanning multiple exchange/segment/series ===");
for (const [sym, fs] of fillsBySym) {
  const keys = new Set(fs.map((f) => `${f.exchange}/${f.segment}/${f.series}`));
  if (keys.size > 1) console.log(`  ${sym}: ${[...keys].join(" | ")}`);
}

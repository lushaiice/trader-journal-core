/**
 * Date-versioned Indian broker charge rates (retail, Zerodha reference).
 *
 * All rates are fractions (0.001 = 0.1%). Choose the schedule whose
 * `effective_from` is the latest date <= trade date. Rates last updated
 * against Zerodha's published charge list as of late 2024. When SEBI /
 * exchanges publish new rates, append a new schedule — never mutate an
 * old one, so historical trades keep reproducing their original charges.
 */

export interface EquityRates {
  delivery: {
    brokerage_bps: 0;
    stt_buy: number; // fraction on buy value
    stt_sell: number; // fraction on sell value
    stt_sell_etf: number; // ETFs (ISIN INF*)
    stamp_buy: number; // fraction on buy value
  };
  intraday: {
    brokerage_bps: number; // fraction per side
    brokerage_cap: number; // INR per order
    stt_sell: number; // fraction on sell value only
    stamp_buy: number;
  };
  txn: {
    nse: number; // per rupee, applied to both legs
    bse: number;
  };
  sebi: number; // per rupee, total turnover
  gst: number; // on (brokerage + txn + sebi)
}

export interface FnoRates {
  futures: {
    brokerage_bps: number;
    brokerage_cap: number;
    stt_sell: number;
    txn_nse: number;
    stamp_buy: number;
  };
  options: {
    brokerage_per_order: number;
    stt_sell: number; // on premium
    txn_nse: number; // on premium
    stamp_buy: number;
  };
  sebi: number;
  gst: number;
}

export interface RateSchedule {
  effective_from: string; // ISO date
  equity: EquityRates;
  fno: FnoRates;
}

// Ordered newest → oldest.
const SCHEDULES: RateSchedule[] = [
  {
    effective_from: "2024-10-01",
    equity: {
      delivery: {
        brokerage_bps: 0,
        stt_buy: 0.001, // 0.1%
        stt_sell: 0.001,
        stt_sell_etf: 0.00001, // 0.001%
        stamp_buy: 0.00015, // 0.015%
      },
      intraday: {
        brokerage_bps: 0.0003, // 0.03%
        brokerage_cap: 20,
        stt_sell: 0.00025, // 0.025%
        stamp_buy: 0.00003, // 0.003%
      },
      txn: {
        nse: 0.0000297, // 0.00297%
        bse: 0.0000375, // 0.00375%
      },
      sebi: 0.000001, // 10 per crore
      gst: 0.18,
    },
    fno: {
      futures: {
        brokerage_bps: 0.0003,
        brokerage_cap: 20,
        stt_sell: 0.0002, // 0.02%
        txn_nse: 0.0000173, // 0.00173%
        stamp_buy: 0.00002, // 0.002%
      },
      options: {
        brokerage_per_order: 20,
        stt_sell: 0.001, // 0.1% on premium
        txn_nse: 0.0003503, // 0.03503% on premium
        stamp_buy: 0.00003, // 0.003%
      },
      sebi: 0.000001,
      gst: 0.18,
    },
  },
];

export function pickSchedule(tradeDate: string): RateSchedule {
  const d = tradeDate.slice(0, 10);
  for (const s of SCHEDULES) {
    if (d >= s.effective_from) return s;
  }
  return SCHEDULES[SCHEDULES.length - 1];
}

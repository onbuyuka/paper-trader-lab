// Core domain types for Paper Trader Lab.
// Everything is paper money. State lives in the browser (localStorage) and can be
// exported / imported as JSON. Prices come from a daily snapshot (public/prices.json).

export type Currency = 'USD' | 'EUR' | 'TRY' | 'GBP' | 'DKK';

export const CURRENCIES: Currency[] = ['USD', 'EUR', 'TRY', 'GBP', 'DKK'];

export type TxnType = 'BUY' | 'SELL';

/** A tradable instrument in our known universe. */
export interface Instrument {
  symbol: string; // canonical ticker shown to the user, e.g. 'AAPL', 'RHM'
  name: string;
  currency: Currency; // native trading currency
  yahoo: string; // symbol used by the price fetch script, e.g. 'AAPL', 'RHM.DE'
  kind?: 'stock' | 'etf' | 'crypto';
}

/** A single paper transaction. */
export interface Transaction {
  id: string;
  symbol: string;
  type: TxnType;
  quantity: number;
  price: number; // price per share in the instrument's native currency
  currency: Currency; // native currency captured at trade time
  date: string; // ISO yyyy-mm-dd
  fee?: number; // optional commission, in native currency
  note?: string;
  /**
   * FX map captured at trade time: fx[c] = value of 1 USD in currency c on the
   * trade date. Used to lock the cost basis at the historical exchange rate so a
   * cross-currency portfolio reflects real currency gains/losses. Optional for
   * backward compatibility (legacy trades fall back to the current rate).
   */
  fxAtTrade?: Record<string, number>;
}

/** A paper portfolio: just a named bag of transactions. */
export interface Portfolio {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  transactions: Transaction[];
  note?: string;
}

/** The whole persisted app state. */
export interface AppState {
  version: number;
  portfolios: Portfolio[];
  displayCurrency: Currency;
}

/** One quote inside the daily price snapshot. */
export interface PriceQuote {
  symbol: string;
  price: number; // last close in native currency
  currency: Currency;
  change?: number; // absolute day change in native currency
  changePct?: number; // percent day change
  date?: string; // date of the close (yyyy-mm-dd)
  name?: string;
}

/** public/prices.json — the snapshot read by the app at runtime. */
export interface PriceData {
  asOf: string; // ISO datetime when the snapshot was generated
  base: Currency; // base currency of the fx map (USD)
  /** fx[c] = value of 1 base unit in currency c, e.g. { USD: 1, EUR: 0.92, TRY: 32.5 } */
  fx: Record<string, number>;
  quotes: Record<string, PriceQuote>; // keyed by symbol
}

/**
 * Derived per-symbol position. Per-share fields (`avgCost`, `lastPrice`) are in the
 * instrument's native currency; aggregate money fields are in the chosen DISPLAY
 * currency. Cost basis (and the cost side of realized PnL) is converted at each
 * trade's locked FX rate, while market value uses today's FX — so the gap between
 * them includes real currency gains/losses.
 */
export interface Holding {
  symbol: string;
  name: string;
  currency: Currency; // native trading currency
  quantity: number;
  avgCost: number; // native currency per share
  costBasis: number; // display currency still invested (locked at trade-date FX)
  lastPrice?: number; // native currency
  marketValue?: number; // display currency (today's FX)
  unrealizedPnl?: number; // display currency
  unrealizedPct?: number;
  realizedPnl: number; // display currency, banked from sells
  dayChange?: number; // display currency, today's move on the open quantity
}

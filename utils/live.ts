// Browser-side live market data via Yahoo Finance, routed through public CORS
// proxies so a fully static site can fetch quotes for tickers that aren't in the
// committed daily snapshot (i.e. anything the user adds by hand). It is strictly a
// best-effort enhancement: the daily snapshot (built server-side by a GitHub Action,
// where there is no CORS restriction) remains the reliable price source.
//
// Only public market data is ever requested. Every failure is swallowed so the app
// silently falls back to the snapshot.

import type { Currency, PriceQuote } from '../types';
import { INSTRUMENTS } from '../data/instruments';

// Tried in order; the first that returns parseable JSON wins.
const PROXIES: Array<(url: string) => string> = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

const YH = 'https://query1.finance.yahoo.com';

// App symbol -> Yahoo symbol for the curated universe (e.g. RHM -> RHM.DE).
const YAHOO_BY_SYMBOL: Record<string, string> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.symbol, i.yahoo]),
);

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Fetch JSON through the proxy chain; returns null if every proxy fails. */
async function fetchJson(url: string): Promise<any | null> {
  for (const wrap of PROXIES) {
    try {
      const res = await fetch(wrap(url), { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        continue;
      }
    } catch {
      // network/CORS failure — try the next proxy
    }
  }
  return null;
}

/** Run an async mapper over items with a bounded concurrency pool. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

function metaToQuote(symbol: string, meta: any): PriceQuote | null {
  if (!meta || meta.regularMarketPrice == null) return null;
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  const change = prevClose != null ? price - prevClose : undefined;
  const changePct = prevClose ? (change! / prevClose) * 100 : undefined;
  return {
    symbol,
    name: meta.longName ?? meta.shortName ?? undefined,
    currency: (meta.currency ?? 'USD') as Currency,
    price: round(price, 4),
    ...(change != null ? { change: round(change, 4), changePct: round(changePct!, 2) } : {}),
    date: meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10)
      : undefined,
  };
}

async function fetchChartMeta(yahooSymbol: string): Promise<any | null> {
  const json = await fetchJson(
    `${YH}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
  );
  return json?.chart?.result?.[0]?.meta ?? null;
}

/**
 * Fetch the closing price for a ticker on a given date (yyyy-mm-dd). Returns the
 * close on that day, or the nearest trading day on/before it (so weekends and
 * holidays resolve to the prior session). Null if there's no data in the window.
 * The returned quote's `date` is the actual session used.
 */
export async function fetchHistoricalPrice(
  yahooSymbol: string,
  date: string,
): Promise<PriceQuote | null> {
  const target = new Date(`${date}T12:00:00Z`).getTime();
  if (!isFinite(target)) return null;
  const DAY = 86_400_000;
  // Look back a week (clears long holiday gaps) and a couple of days forward.
  const period1 = Math.floor((target - 8 * DAY) / 1000);
  const period2 = Math.floor((target + 2 * DAY) / 1000);
  const json = await fetchJson(
    `${YH}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${period1}&period2=${period2}&interval=1d`,
  );
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta;
  const timestamps: number[] = result.timestamp ?? [];
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];

  // Most recent session whose date is on or before the target date.
  let best: { ts: number; close: number } | null = null;
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    const tsDate = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    if (tsDate <= date && (!best || timestamps[i] > best.ts)) {
      best = { ts: timestamps[i], close };
    }
  }
  if (!best) return null;
  return {
    symbol: yahooSymbol,
    name: meta?.longName ?? meta?.shortName ?? undefined,
    currency: (meta?.currency ?? 'USD') as Currency,
    price: round(best.close, 4),
    date: new Date(best.ts * 1000).toISOString().slice(0, 10),
  };
}

// FX pairs used to build the trade-date fx map. Mirrors the snapshot script:
// fx[c] = value of 1 USD in currency c. EUR/GBP come from <CUR>USD=X (inverted);
// TRY/DKK come from USD<CUR>=X directly.
const HISTORICAL_FX_PAIRS = [
  { code: 'EUR', yahoo: 'EURUSD=X', invert: true },
  { code: 'GBP', yahoo: 'GBPUSD=X', invert: true },
  { code: 'TRY', yahoo: 'USDTRY=X', invert: false },
  { code: 'DKK', yahoo: 'USDDKK=X', invert: false },
];

/**
 * Fetch the FX map (value of 1 USD in each currency) on a given date, using the
 * historical close of each pair. USD is always 1. Currencies that can't be
 * resolved are simply omitted (callers fall back to the current rate).
 */
export async function fetchHistoricalFx(date: string): Promise<Record<string, number>> {
  const out: Record<string, number> = { USD: 1 };
  await pool(HISTORICAL_FX_PAIRS, 4, async ({ code, yahoo, invert }) => {
    const quote = await fetchHistoricalPrice(yahoo, date);
    const rate = quote?.price;
    if (rate) out[code] = round(invert ? 1 / rate : rate, 6);
  });
  return out;
}

/** Fetch live quotes for the given app symbols, keyed back by app symbol. */
export async function fetchLiveQuotes(symbols: string[]): Promise<Record<string, PriceQuote>> {
  const out: Record<string, PriceQuote> = {};
  await pool(symbols, 4, async (symbol) => {
    const yahoo = YAHOO_BY_SYMBOL[symbol] ?? symbol;
    const meta = await fetchChartMeta(yahoo);
    const quote = metaToQuote(symbol, meta);
    if (quote) out[symbol] = quote;
  });
  return out;
}

/** Resolve a single ticker's live quote (used when adding a trade). */
export async function fetchQuote(yahooSymbol: string): Promise<PriceQuote | null> {
  const meta = await fetchChartMeta(yahooSymbol);
  return metaToQuote(yahooSymbol, meta);
}

/**
 * Fetch an FX map for the given currencies. fx[c] = value of 1 USD in currency c,
 * via the USD<CUR>=X pair. USD is always 1.
 */
export async function fetchFxRates(currencies: Currency[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const targets = [...new Set(currencies)].filter((c) => c !== 'USD');
  await pool(targets, 4, async (cur) => {
    const meta = await fetchChartMeta(`USD${cur}=X`);
    const rate = meta?.regularMarketPrice;
    if (rate) out[cur] = round(rate, 6);
  });
  return out;
}

export interface SymbolHit {
  symbol: string; // Yahoo symbol, used directly as the app symbol for added tickers
  name: string;
  exchange?: string;
  quoteType?: string;
}

const ALLOWED_TYPES = new Set(['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'INDEX', 'CURRENCY', 'MUTUALFUND']);

/** Search Yahoo for any ticker by symbol or company name. */
export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const q = query.trim();
  if (!q) return [];
  const json = await fetchJson(
    `${YH}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
  );
  const quotes: any[] = json?.quotes ?? [];
  return quotes
    .filter((r) => r.symbol && ALLOWED_TYPES.has(r.quoteType))
    .map((r) => ({
      symbol: r.symbol,
      name: r.shortname ?? r.longname ?? r.symbol,
      exchange: r.exchange,
      quoteType: r.quoteType,
    }));
}

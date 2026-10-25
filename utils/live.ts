// Browser-side live market data via Yahoo Finance, routed through public CORS
// proxies (plus CNBC's CORS-enabled quote service for today's prices) so a fully
// static site can fetch quotes for tickers that aren't in the committed daily
// snapshot (i.e. anything the user adds by hand). It is strictly a
// best-effort enhancement: the daily snapshot (built server-side by a GitHub Action,
// where there is no CORS restriction) remains the reliable price source.
//
// Only public market data is ever requested. Every failure is swallowed so the app
// silently falls back to the snapshot.

import type { Currency, PriceQuote } from '../types';
import { INSTRUMENTS } from '../data/instruments';

// Tried in order; the first that returns parseable JSON wins. corsproxy.io was
// dropped once it started requiring an API key. `unwrap` extracts the upstream
// body from proxies that wrap it in an envelope.
interface Proxy {
  wrap: (url: string) => string;
  unwrap?: (body: string) => string;
}
const PROXIES: Proxy[] = [
  { wrap: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  {
    wrap: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    unwrap: (body) => JSON.parse(body).contents,
  },
  { wrap: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}` },
];

// Public proxies can hang for 20s+; give up on each one quickly instead.
const FETCH_TIMEOUT_MS = 6000;

const YH = 'https://query1.finance.yahoo.com';

// CNBC's quote, daily-bar and symbol-lookup services send
// `Access-Control-Allow-Origin: *`, so prices, history and search for most US and
// many international tickers can be fetched without a proxy. They accept both
// Yahoo-style (RHM.DE) and CNBC-style (RHM-DE) symbols.
const CNBC_QUOTE =
  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?requestMethod=itv&noform=1&partnerId=2&fund=1&exthrs=1&output=json&symbols=';
const CNBC_BARS = 'https://ts-api.cnbc.com/harmony/app/bars/';
const CNBC_SEARCH =
  'https://symlookup.cnbc.com/symservice/symlookup.do?partnerid=20064&fund=1&output=json&prefix=';

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
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy.wrap(url), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const text = await res.text();
      try {
        return JSON.parse(proxy.unwrap ? proxy.unwrap(text) : text);
      } catch {
        continue;
      }
    } catch {
      // network/CORS failure or timeout — try the next proxy
    }
  }
  return null;
}

/** Fetch JSON from a CORS-enabled endpoint directly; null on any failure. */
async function fetchDirectJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const cnbcNumber = (v: unknown): number | undefined => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

/** Raw CNBC quote record, or null if CNBC doesn't know the ticker. */
async function fetchCnbcRaw(symbol: string): Promise<any | null> {
  const json = await fetchDirectJson(`${CNBC_QUOTE}${encodeURIComponent(symbol)}`);
  const q = json?.FormattedQuoteResult?.FormattedQuote?.[0];
  return q && Number(q.code) === 0 ? q : null;
}

/** Today's quote straight from CNBC (no proxy), or null if it doesn't know the ticker. */
async function fetchCnbcQuote(symbol: string, yahooSymbol: string): Promise<PriceQuote | null> {
  const q = await fetchCnbcRaw(yahooSymbol);
  const price = cnbcNumber(q?.last);
  if (!q || !price || !q.currencyCode) return null;
  const prevClose = cnbcNumber(q.previous_day_closing);
  const change = prevClose ? price - prevClose : undefined;
  return {
    symbol,
    name: q.name || undefined,
    currency: q.currencyCode as Currency,
    price: round(price, 4),
    ...(change != null && prevClose
      ? { change: round(change, 4), changePct: round((change / prevClose) * 100, 2) }
      : {}),
    date: typeof q.last_time === 'string' ? q.last_time.slice(0, 10) : undefined,
  };
}

/** yyyy-mm-dd -> CNBC's yyyymmdd000000 timestamp. */
const cnbcStamp = (ms: number) => `${new Date(ms).toISOString().slice(0, 10).replace(/-/g, '')}000000`;

/**
 * Close on `date` (or the nearest earlier session in the preceding week) from
 * CNBC's daily bars, or null. Currency is looked up separately unless supplied.
 */
async function fetchCnbcClose(
  symbol: string,
  date: string,
  currency?: Currency,
): Promise<PriceQuote | null> {
  const target = new Date(`${date}T12:00:00Z`).getTime();
  if (!isFinite(target)) return null;
  const DAY = 86_400_000;
  const [bars, q] = await Promise.all([
    fetchDirectJson(
      `${CNBC_BARS}${encodeURIComponent(symbol)}/1D/${cnbcStamp(target - 8 * DAY)}/${cnbcStamp(target + 2 * DAY)}/adjusted/EST5EDT.json`,
    ),
    currency ? Promise.resolve(null) : fetchCnbcRaw(symbol),
  ]);
  const target8 = date.replace(/-/g, '');
  let best: { day: string; close: number } | null = null;
  for (const bar of bars?.barData?.priceBars ?? []) {
    const day = String(bar.tradeTime ?? '').slice(0, 8);
    const close = cnbcNumber(bar.close);
    if (day.length === 8 && close && day <= target8 && (!best || day > best.day)) {
      best = { day, close };
    }
  }
  const cur = currency ?? (q?.currencyCode as Currency | undefined);
  if (!best || !cur) return null;
  return {
    symbol,
    name: q?.name || undefined,
    currency: cur,
    price: round(best.close, 4),
    date: `${best.day.slice(0, 4)}-${best.day.slice(4, 6)}-${best.day.slice(6, 8)}`,
  };
}

/** Today's quote: CNBC first (direct), then Yahoo through the proxy chain. */
async function fetchTodayQuote(symbol: string, yahooSymbol: string): Promise<PriceQuote | null> {
  return (
    (await fetchCnbcQuote(symbol, yahooSymbol)) ??
    metaToQuote(symbol, await fetchChartMeta(yahooSymbol))
  );
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
 * The returned quote's `date` is the actual session used. CNBC is tried first
 * (direct), then Yahoo through the proxy chain.
 */
export async function fetchHistoricalPrice(
  yahooSymbol: string,
  date: string,
): Promise<PriceQuote | null> {
  return (await fetchCnbcClose(yahooSymbol, date)) ?? fetchYahooClose(yahooSymbol, date);
}

async function fetchYahooClose(yahooSymbol: string, date: string): Promise<PriceQuote | null> {
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
// TRY/DKK come from USD<CUR>=X directly. CNBC quotes the same pairs as `<CUR>=`.
const FX_PAIRS: Array<{ code: Currency; yahoo: string; cnbc: string; invert: boolean }> = [
  { code: 'EUR', yahoo: 'EURUSD=X', cnbc: 'EUR=', invert: true },
  { code: 'GBP', yahoo: 'GBPUSD=X', cnbc: 'GBP=', invert: true },
  { code: 'TRY', yahoo: 'USDTRY=X', cnbc: 'TRY=', invert: false },
  { code: 'DKK', yahoo: 'USDDKK=X', cnbc: 'DKK=', invert: false },
];

/**
 * Fetch the FX map (value of 1 USD in each currency) on a given date, using the
 * historical close of each pair. USD is always 1. Currencies that can't be
 * resolved are simply omitted (callers fall back to the current rate).
 */
export async function fetchHistoricalFx(date: string): Promise<Record<string, number>> {
  const out: Record<string, number> = { USD: 1 };
  await pool(FX_PAIRS, 4, async ({ code, yahoo, cnbc, invert }) => {
    const quote =
      (await fetchCnbcClose(cnbc, date, 'USD')) ?? (await fetchYahooClose(yahoo, date));
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
    const quote = await fetchTodayQuote(symbol, yahoo);
    if (quote) out[symbol] = quote;
  });
  return out;
}

/** Resolve a single ticker's live quote (used when adding a trade). */
export async function fetchQuote(yahooSymbol: string): Promise<PriceQuote | null> {
  return fetchTodayQuote(yahooSymbol, yahooSymbol);
}

/**
 * Fetch an FX map for the given currencies. fx[c] = value of 1 USD in currency c,
 * from CNBC's `<CUR>=` pair or else Yahoo's USD<CUR>=X pair. USD is always 1.
 */
export async function fetchFxRates(currencies: Currency[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const targets = [...new Set(currencies)].filter((c) => c !== 'USD');
  await pool(targets, 4, async (cur) => {
    const pair = FX_PAIRS.find((p) => p.code === cur);
    const cnbcRate = pair ? cnbcNumber((await fetchCnbcRaw(pair.cnbc))?.last) : undefined;
    if (pair && cnbcRate) {
      out[cur] = round(pair.invert ? 1 / cnbcRate : cnbcRate, 6);
      return;
    }
    const meta = await fetchChartMeta(`USD${cur}=X`);
    const rate = meta?.regularMarketPrice;
    if (rate) out[cur] = round(rate, 6);
  });
  return out;
}

export interface SymbolHit {
  symbol: string; // Yahoo- or CNBC-style symbol, used directly as the app symbol for added tickers
  name: string;
  exchange?: string;
  quoteType?: string;
}

const ALLOWED_TYPES = new Set(['EQUITY', 'ETF', 'CRYPTOCURRENCY', 'INDEX', 'CURRENCY', 'MUTUALFUND']);
// CNBC issue types -> the Yahoo quote types above.
const CNBC_TYPES: Record<string, string> = {
  STOCK: 'EQUITY',
  ETF: 'ETF',
  FUND: 'MUTUALFUND',
  INDEX: 'INDEX',
};

/** Search for any ticker by symbol or company name: CNBC first, then Yahoo. */
export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const q = query.trim();
  if (!q) return [];
  const cnbc = await fetchDirectJson(`${CNBC_SEARCH}${encodeURIComponent(q)}`);
  const cnbcHits: SymbolHit[] = (Array.isArray(cnbc) ? cnbc.slice(1) : [])
    .filter((r: any) => r?.symbolName && CNBC_TYPES[r.issueType])
    .slice(0, 10)
    .map((r: any) => ({
      symbol: r.symbolName,
      name: r.companyName ?? r.symbolName,
      exchange: r.exchangeName,
      quoteType: CNBC_TYPES[r.issueType],
    }));
  if (cnbcHits.length) return cnbcHits;

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

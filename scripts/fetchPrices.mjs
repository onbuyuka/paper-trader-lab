// Fetches an end-of-day price snapshot for every instrument in data/universe.json
// and writes public/prices.json. Uses Yahoo Finance's public chart endpoint — no API key.
//
//   node scripts/fetchPrices.mjs
//   PRICES_OUT=/path/to/prices.json node scripts/fetchPrices.mjs   # custom output
//
// Yahoo chart endpoint returns JSON with a `meta` block per symbol:
//   https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d
//   meta.regularMarketPrice, meta.chartPreviousClose, meta.currency, meta.regularMarketTime
// FX pairs use the same endpoint with the `=X` suffix (EURUSD=X, GBPUSD=X, USDTRY=X).

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const UNIVERSE_PATH = resolve(ROOT, 'data/universe.json');
// Override with PRICES_OUT to write straight into the deployed site (gh-pages).
const OUT_PATH = process.env.PRICES_OUT
  ? resolve(process.env.PRICES_OUT)
  : resolve(ROOT, 'public/prices.json');

const FX_PAIRS = [
  { yahoo: 'EURUSD=X', invert: true, code: 'EUR' }, // 1 EUR = X USD -> fx.EUR = 1/X
  { yahoo: 'GBPUSD=X', invert: true, code: 'GBP' },
  { yahoo: 'USDTRY=X', invert: false, code: 'TRY' }, // 1 USD = X TRY -> fx.TRY = X
  { yahoo: 'USDDKK=X', invert: false, code: 'DKK' },
];

const CHART_URL = (sym) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;

/** Fetch the Yahoo chart `meta` block for a symbol, or null on failure. */
async function fetchMeta(yahooSymbol) {
  try {
    const res = await fetch(CHART_URL(yahooSymbol), {
      headers: { 'User-Agent': 'Mozilla/5.0 (paper-trader-lab)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) throw new Error('no price in payload');
    return meta;
  } catch (err) {
    console.warn(`  ! ${yahooSymbol}: ${err.message}`);
    return null;
  }
}

function isoDate(epochSeconds) {
  if (!epochSeconds) return undefined;
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

/** Map a small concurrency pool over items. */
async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(OUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

async function main() {
  const universe = JSON.parse(await readFile(UNIVERSE_PATH, 'utf8'));
  const previous = await readPrevious();
  console.log(`Fetching ${universe.length} quotes + ${FX_PAIRS.length} FX pairs from Yahoo Finance…`);

  // Quotes
  const quotes = {};
  await pool(universe, 5, async (inst) => {
    const meta = await fetchMeta(inst.yahoo);
    const prev = previous?.quotes?.[inst.symbol];
    if (!meta) {
      if (prev) quotes[inst.symbol] = prev; // keep last good value
      return;
    }
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose;
    const change = prevClose != null ? price - prevClose : undefined;
    const changePct = prevClose ? (change / prevClose) * 100 : undefined;
    quotes[inst.symbol] = {
      symbol: inst.symbol,
      name: inst.name,
      currency: inst.currency,
      price: round(price, 4),
      ...(change != null ? { change: round(change, 4), changePct: round(changePct, 2) } : {}),
      date: isoDate(meta.regularMarketTime),
    };
    console.log(`  ✓ ${inst.symbol.padEnd(6)} ${round(price, 2)} ${inst.currency}`);
  });

  // FX
  const fx = { USD: 1 };
  await pool(FX_PAIRS, 3, async ({ yahoo, invert, code }) => {
    const meta = await fetchMeta(yahoo);
    const rate = meta?.regularMarketPrice;
    if (!rate) {
      const prev = previous?.fx?.[code];
      if (prev) fx[code] = prev;
      return;
    }
    fx[code] = round(invert ? 1 / rate : rate, 6);
    console.log(`  ✓ ${code} = ${fx[code]}`);
  });
  // Backfill any FX still missing from the previous snapshot.
  for (const { code } of FX_PAIRS) {
    if (fx[code] == null && previous?.fx?.[code] != null) fx[code] = previous.fx[code];
  }

  const snapshot = { asOf: new Date().toISOString(), base: 'USD', fx, quotes };
  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${Object.keys(quotes).length} quotes to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

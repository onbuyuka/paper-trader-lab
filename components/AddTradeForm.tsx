import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Currency, TxnType } from '../types';
import { searchInstruments, getInstrument } from '../data/instruments';
import { fetchHistoricalFx, fetchHistoricalPrice, fetchQuote, searchSymbols, type SymbolHit } from '../utils/live';
import { currencySymbol, formatDate, todayISO } from '../utils/format';
import { usePrices } from './PriceStore';
import { useStore } from './PortfolioStore';

interface Picked {
  symbol: string;
  name: string;
  currency: Currency;
  exchange?: string;
}

export const AddTradeForm: React.FC<{ portfolioId: string }> = ({ portfolioId }) => {
  const { prices } = usePrices();
  const { addTransaction } = useStore();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [showList, setShowList] = useState(false);
  const [remote, setRemote] = useState<SymbolHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);

  const [type, setType] = useState<TxnType>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [priceEdited, setPriceEdited] = useState(false);
  const [priceAsOf, setPriceAsOf] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [fee, setFee] = useState('');
  // FX map captured for the selected trade date, locked onto the transaction so the
  // cost basis reflects the historical exchange rate.
  const [tradeFx, setTradeFx] = useState<Record<string, number> | null>(null);

  const localMatches = useMemo(() => searchInstruments(query), [query]);
  const reqId = useRef(0);
  const priceReqId = useRef(0);

  // Debounced remote search for any ticker on Yahoo.
  useEffect(() => {
    const q = query.trim();
    if (picked || q.length < 2) {
      setRemote([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      const hits = await searchSymbols(q);
      if (id === reqId.current) {
        setRemote(hits);
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [query, picked]);

  // Merge local universe hits with remote hits, de-duplicated by symbol.
  const results = useMemo(() => {
    const seen = new Set(localMatches.map((m) => m.symbol.toUpperCase()));
    const merged: { symbol: string; name: string; currency?: Currency; tag: string }[] =
      localMatches.map((m) => ({ symbol: m.symbol, name: m.name, currency: m.currency, tag: m.currency }));
    for (const r of remote) {
      if (seen.has(r.symbol.toUpperCase())) continue;
      merged.push({ symbol: r.symbol, name: r.name, tag: r.exchange ?? r.quoteType ?? '' });
    }
    return merged.slice(0, 12);
  }, [localMatches, remote]);

  const nativeCur = picked?.currency ?? 'USD';

  // Pick a ticker. Price + final currency are filled by the effect below, which
  // looks up the price for the selected date (today's quote, or the historical
  // close for a past date).
  const pick = (symbol: string, name: string, currency?: Currency) => {
    setShowList(false);
    setRemote([]);
    setPriceEdited(false);
    setPrice('');
    setPriceAsOf(null);
    const known = getInstrument(symbol);
    const cur = (known?.currency ?? currency ?? 'USD') as Currency;
    setPicked({ symbol: known?.symbol ?? symbol, name: known?.name ?? name, currency: cur });
    setQuery(`${known?.symbol ?? symbol} · ${known?.name ?? name}`);
  };

  // Fill the price for the chosen ticker + date: the cached/live quote for today,
  // or the historical close for a past date. Skipped once the user edits the price
  // by hand, so manual entries are never clobbered.
  useEffect(() => {
    if (!picked || priceEdited) return;
    const id = ++priceReqId.current;
    const yahoo = getInstrument(picked.symbol)?.yahoo ?? picked.symbol;
    const isToday = date >= todayISO();

    // For today, a cached snapshot/live quote avoids a network round-trip.
    if (isToday) {
      const cached = prices?.quotes[picked.symbol];
      if (cached) {
        setPrice(String(cached.price));
        setPriceAsOf(null);
        return;
      }
    }

    setResolving(true);
    setPriceAsOf(null);
    (async () => {
      const quote = isToday
        ? await fetchQuote(yahoo)
        : await fetchHistoricalPrice(yahoo, date);
      if (id !== priceReqId.current) return; // a newer request superseded this one
      if (quote) {
        setPrice(String(quote.price));
        setPriceAsOf(isToday ? null : (quote.date ?? date));
        if (quote.currency && quote.currency !== picked.currency) {
          setPicked((p) => (p ? { ...p, currency: quote.currency } : p));
        }
      }
      setResolving(false);
    })().catch(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.symbol, date, priceEdited]);

  // Resolve the FX map for the selected date: today's snapshot rates, or the
  // historical close for a past date. Independent of the price field so it's ready
  // even when the user types the price by hand.
  useEffect(() => {
    if (date >= todayISO()) {
      setTradeFx(prices?.fx ?? null);
      return;
    }
    let cancelled = false;
    fetchHistoricalFx(date)
      .then((fx) => {
        if (!cancelled) setTradeFx(fx);
      })
      .catch(() => {
        /* fall back to today's rate at submit time */
      });
    return () => {
      cancelled = true;
    };
  }, [date, prices?.asOf]);

  const reset = () => {
    setQuery('');
    setPicked(null);
    setRemote([]);
    setQuantity('');
    setPrice('');
    setPriceEdited(false);
    setPriceAsOf(null);
    setFee('');
    setType('BUY');
    setDate(todayISO());
  };

  const qtyNum = Number(quantity);
  const priceNum = Number(price);
  const valid = picked && qtyNum > 0 && priceNum > 0 && !resolving;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked || !valid) return;
    addTransaction(portfolioId, {
      symbol: picked.symbol,
      type,
      quantity: qtyNum,
      price: priceNum,
      currency: picked.currency,
      date,
      fee: fee ? Number(fee) : undefined,
      fxAtTrade: tradeFx ?? prices?.fx ?? undefined,
    });
    reset();
  };

  const estimate = valid ? qtyNum * priceNum + (fee ? Number(fee) : 0) : 0;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Symbol search — any ticker */}
        <div className="relative sm:col-span-2">
          <label className="block text-xs uppercase tracking-wide text-paper-300/60 mb-1">
            Ticker <span className="text-paper-300/40">· search any stock, ETF or crypto</span>
          </label>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            placeholder="e.g. TSLA, Rheinmetall, BTC-USD, NVO.CO…"
            className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-paper-50 focus:border-brandx-500 focus:outline-none"
          />
          {showList && !picked && (query.trim().length > 0 || results.length > 0) && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-white/10 bg-ink-900 shadow-xl">
              {results.map((m) => (
                <li key={m.symbol}>
                  <button
                    type="button"
                    onClick={() => pick(m.symbol, m.name, m.currency)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
                  >
                    <span className="font-600 text-paper-50 shrink-0">{m.symbol}</span>
                    <span className="truncate text-paper-300/70">{m.name}</span>
                    <span className="shrink-0 text-xs text-paper-300/50">{m.tag}</span>
                  </button>
                </li>
              ))}
              {searching && (
                <li className="px-3 py-2 text-xs text-paper-300/50">Searching Yahoo…</li>
              )}
              {!searching && results.length === 0 && query.trim().length >= 2 && (
                <li className="px-3 py-2 text-xs text-paper-300/50">No matches.</li>
              )}
            </ul>
          )}
        </div>

        {/* Buy / Sell */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-paper-300/60 mb-1">Side</label>
          <div className="flex rounded-lg bg-white/5 p-0.5">
            {(['BUY', 'SELL'] as TxnType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-md py-1.5 text-sm font-600 transition-colors ${
                  type === t
                    ? t === 'BUY'
                      ? 'bg-gain-600 text-white'
                      : 'bg-loss-600 text-white'
                    : 'text-paper-300 hover:text-paper-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-paper-300/60 mb-1">Date</label>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="num w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-paper-50 focus:border-brandx-500 focus:outline-none"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-paper-300/60 mb-1">
            Quantity
          </label>
          <input
            type="number"
            min={0}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="num w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-paper-50 focus:border-brandx-500 focus:outline-none"
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-xs uppercase tracking-wide text-paper-300/60 mb-1">
            Price ({nativeCur}){' '}
            {resolving ? (
              <span className="text-paper-300/40">· fetching…</span>
            ) : priceAsOf ? (
              <span className="text-paper-300/40">· close {formatDate(priceAsOf)}</span>
            ) : null}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper-300/60 text-sm">
              {currencySymbol(nativeCur)}
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setPriceEdited(true);
                setPriceAsOf(null);
              }}
              placeholder="0.00"
              className="num w-full rounded-lg border border-white/10 bg-ink-950 py-2 pl-7 pr-3 text-sm text-paper-50 focus:border-brandx-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-paper-300/60">
          <span>Fee</span>
          <input
            type="number"
            min={0}
            step="any"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0"
            className="num w-20 rounded-md border border-white/10 bg-ink-950 px-2 py-1 text-paper-50 focus:border-brandx-500 focus:outline-none"
          />
          {valid && (
            <span className="ml-1">
              ≈ {currencySymbol(nativeCur)}
              {estimate.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
              {type === 'BUY' ? 'out' : 'in'}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!valid}
          className="rounded-lg bg-brandx-500 px-4 py-2 text-sm font-600 text-white hover:bg-brandx-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add {type === 'BUY' ? 'buy' : 'sell'}
        </button>
      </div>
    </form>
  );
};

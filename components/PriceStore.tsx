import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Currency, PriceData, PriceQuote } from '../types';
import { CURRENCIES } from '../types';
import { makeConverter } from '../utils/fx';
import { fetchFxRates, fetchLiveQuotes } from '../utils/live';
import { useStore } from './PortfolioStore';

interface PriceContextValue {
  prices: PriceData | null;
  loading: boolean; // initial snapshot load
  refreshing: boolean; // a live fetch (for custom tickers) is in flight
  isLive: boolean; // at least one live quote has merged in
  asOf: string | null;
  error: string | null;
  convert: (amount: number, from: Currency, to: Currency) => number;
  reload: () => void; // re-read the committed snapshot
  refreshLive: () => void; // re-pull live quotes now
}

const PriceContext = createContext<PriceContextValue | null>(null);

const PRICES_URL = `${import.meta.env.BASE_URL}prices.json`;

interface Live {
  quotes: Record<string, PriceQuote>;
  fx: Record<string, number>;
  asOf: string | null;
}

const EMPTY_LIVE: Live = { quotes: {}, fx: {}, asOf: null };

export const PriceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useStore();
  const [snapshot, setSnapshot] = useState<PriceData | null>(null);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapNonce, setSnapNonce] = useState(0);
  const [liveNonce, setLiveNonce] = useState(0);

  // 1) Load the committed snapshot (offline baseline + first paint). This is the
  //    reliable price source and never depends on a proxy.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(PRICES_URL, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: PriceData) => {
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapNonce]);

  // Symbols held across all portfolios.
  const heldSymbols = useMemo(() => {
    const s = new Set<string>();
    for (const p of state.portfolios) for (const t of p.transactions) s.add(t.symbol);
    return s;
  }, [state.portfolios]);

  // Only the held tickers that the snapshot doesn't already price need a live pull.
  // (The curated universe is fully covered by the daily snapshot.)
  const liveKey = useMemo(() => {
    if (!snapshot) return '';
    return Array.from(heldSymbols)
      .filter((sym) => !snapshot.quotes[sym])
      .sort()
      .join(',');
  }, [heldSymbols, snapshot]);

  // 2) Best-effort live quotes for those custom tickers, overlaid on the snapshot.
  useEffect(() => {
    const symbols = liveKey ? liveKey.split(',') : [];
    if (symbols.length === 0) {
      setRefreshing(false);
      return;
    }
    let cancelled = false;
    setRefreshing(true);
    (async () => {
      const quotes = await fetchLiveQuotes(symbols);
      const currencies = new Set<Currency>(CURRENCIES);
      Object.values(quotes).forEach((q) => currencies.add(q.currency));
      const fx = await fetchFxRates(Array.from(currencies));
      if (cancelled) return;
      if (Object.keys(quotes).length > 0 || Object.keys(fx).length > 0) {
        setLive({ quotes, fx, asOf: new Date().toISOString() });
      }
    })()
      .catch(() => {
        /* keep the snapshot baseline on any failure */
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [liveKey, liveNonce]);

  // Merge: live quotes/fx win over the snapshot baseline.
  const prices = useMemo<PriceData | null>(() => {
    const hasLive = Object.keys(live.quotes).length > 0 || Object.keys(live.fx).length > 0;
    if (!snapshot && !hasLive) return null;
    const base: PriceData = snapshot ?? { asOf: '', base: 'USD', fx: { USD: 1 }, quotes: {} };
    return {
      asOf: base.asOf,
      base: 'USD',
      fx: { ...base.fx, ...live.fx },
      quotes: { ...base.quotes, ...live.quotes },
    };
  }, [snapshot, live]);

  const value = useMemo<PriceContextValue>(
    () => ({
      prices,
      loading,
      refreshing,
      isLive: Object.keys(live.quotes).length > 0,
      asOf: prices?.asOf || live.asOf,
      error,
      convert: makeConverter(prices),
      reload: () => setSnapNonce((n) => n + 1),
      refreshLive: () => {
        setLive(EMPTY_LIVE);
        setLiveNonce((n) => n + 1);
      },
    }),
    [prices, loading, refreshing, live, error],
  );

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
};

export function usePrices(): PriceContextValue {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error('usePrices must be used within a PriceProvider');
  return ctx;
}

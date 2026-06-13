import type { Instrument } from '../types';
import universe from './universe.json';

/**
 * The known tradable universe. This is the single source of truth for both the app
 * and the price-fetch script (scripts/fetchPrices.mjs reads the same universe.json).
 * Add a row here (and it gets picked up by the next daily price snapshot).
 */
export const INSTRUMENTS: Instrument[] = universe as Instrument[];

export const INSTRUMENT_BY_SYMBOL: Record<string, Instrument> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.symbol, i]),
);

export function getInstrument(symbol: string): Instrument | undefined {
  return INSTRUMENT_BY_SYMBOL[symbol.toUpperCase()];
}

/** Case-insensitive search over symbol + name, for the add-trade autocomplete. */
export function searchInstruments(query: string, limit = 8): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSTRUMENTS.slice(0, limit);
  return INSTRUMENTS.filter(
    (i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
  ).slice(0, limit);
}

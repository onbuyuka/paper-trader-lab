import type { Currency, PriceData } from '../types';

/**
 * Convert an amount between currencies using the snapshot's fx map.
 * fx[c] = value of 1 base unit (USD) in currency c, so:
 *   amount_to = amount_from / fx[from] * fx[to]
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  fx: Record<string, number>,
): number {
  if (from === to) return amount;
  const rFrom = fx[from];
  const rTo = fx[to];
  if (!rFrom || !rTo) return amount; // missing rate: fail safe to identity
  return (amount / rFrom) * rTo;
}

/** Curried converter bound to a snapshot, for convenience in components. */
export function makeConverter(prices: PriceData | null) {
  return (amount: number, from: Currency, to: Currency): number => {
    if (!prices) return amount;
    return convert(amount, from, to, prices.fx);
  };
}

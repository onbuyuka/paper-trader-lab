import { describe, it, expect } from 'vitest';
import type { PriceData, Portfolio } from '../types';
import { computeHoldings, summarize } from '../utils/portfolio';
import { convert } from '../utils/fx';

const prices: PriceData = {
  asOf: '2026-03-02T20:00:00Z',
  base: 'USD',
  fx: { USD: 1, EUR: 0.92, GBP: 0.79, TRY: 32.5 },
  quotes: {
    AAPL: { symbol: 'AAPL', currency: 'USD', price: 130, change: 2, changePct: 1.56 },
    RHM: { symbol: 'RHM', currency: 'EUR', price: 600, change: 10, changePct: 1.69 },
  },
};

function pf(transactions: Portfolio['transactions']): Portfolio {
  return { id: 'p1', name: 'Test', color: '#fff', createdAt: '', transactions };
}

describe('computeHoldings (average cost)', () => {
  it('averages buys and banks realized PnL on a sell', () => {
    const portfolio = pf([
      { id: '1', symbol: 'AAPL', type: 'BUY', quantity: 10, price: 100, currency: 'USD', date: '2026-01-01' },
      { id: '2', symbol: 'AAPL', type: 'BUY', quantity: 10, price: 120, currency: 'USD', date: '2026-02-01' },
      { id: '3', symbol: 'AAPL', type: 'SELL', quantity: 5, price: 150, currency: 'USD', date: '2026-03-01' },
    ]);
    const [h] = computeHoldings(portfolio, prices, 'USD');

    expect(h.quantity).toBe(15);
    expect(h.avgCost).toBeCloseTo(110, 6); // (1000 + 1200) / 20
    expect(h.costBasis).toBeCloseTo(1650, 6); // 2200 - 110*5
    expect(h.realizedPnl).toBeCloseTo(200, 6); // (150 - 110) * 5
    expect(h.marketValue).toBeCloseTo(1950, 6); // 15 * 130
    expect(h.unrealizedPnl).toBeCloseTo(300, 6); // 1950 - 1650
    expect(h.unrealizedPct).toBeCloseTo(18.1818, 3);
    expect(h.dayChange).toBeCloseTo(30, 6); // 15 * 2
  });

  it('folds buy fees into the cost basis', () => {
    const portfolio = pf([
      { id: '1', symbol: 'AAPL', type: 'BUY', quantity: 10, price: 100, currency: 'USD', date: '2026-01-01', fee: 5 },
    ]);
    const [h] = computeHoldings(portfolio, prices, 'USD');
    expect(h.costBasis).toBeCloseTo(1005, 6);
    expect(h.avgCost).toBeCloseTo(100.5, 6);
  });

  it('clamps a sell to the available quantity and closes the position', () => {
    const portfolio = pf([
      { id: '1', symbol: 'AAPL', type: 'BUY', quantity: 5, price: 100, currency: 'USD', date: '2026-01-01' },
      { id: '2', symbol: 'AAPL', type: 'SELL', quantity: 99, price: 120, currency: 'USD', date: '2026-02-01' },
    ]);
    const [h] = computeHoldings(portfolio, prices, 'USD');
    expect(h.quantity).toBe(0);
    expect(h.costBasis).toBe(0);
    expect(h.realizedPnl).toBeCloseTo(100, 6); // (120 - 100) * 5
  });
});

describe('summarize (display currency)', () => {
  it('converts a EUR holding into the USD display total', () => {
    const portfolio = pf([
      { id: '1', symbol: 'RHM', type: 'BUY', quantity: 2, price: 500, currency: 'EUR', date: '2026-01-01' },
    ]);
    const holdings = computeHoldings(portfolio, prices, 'USD');
    const s = summarize(holdings, 'USD');

    // 2 * 600 EUR = 1200 EUR -> /0.92 = 1304.35 USD
    expect(s.marketValue).toBeCloseTo(1200 / 0.92, 4);
    expect(s.costBasis).toBeCloseTo(1000 / 0.92, 4);
    expect(s.unrealizedPnl).toBeCloseTo(200 / 0.92, 4);
    expect(s.openPositions).toBe(1);
  });
});

describe('historical FX (locked cost basis)', () => {
  // EUR was stronger at trade time (1 USD = 0.80 EUR) than today (1 USD = 0.92 EUR).
  const fxAtTrade = { USD: 1, EUR: 0.8, GBP: 0.79, TRY: 32.5 };

  it('locks cost basis at the trade-date rate when viewing in USD', () => {
    const portfolio = pf([
      { id: '1', symbol: 'RHM', type: 'BUY', quantity: 2, price: 500, currency: 'EUR', date: '2026-01-01', fxAtTrade },
    ]);
    const [h] = computeHoldings(portfolio, prices, 'USD');

    // Cost basis locked at trade-date FX: 1000 EUR / 0.80 = $1250.
    expect(h.costBasis).toBeCloseTo(1000 / 0.8, 4);
    // Market value at today's FX: 1200 EUR / 0.92.
    expect(h.marketValue).toBeCloseTo(1200 / 0.92, 4);
    // Unrealized includes the currency move (differs from the no-FX-lock result).
    expect(h.unrealizedPnl).toBeCloseTo(1200 / 0.92 - 1000 / 0.8, 4);
  });

  it('shows pure price PnL when the display currency equals the native currency', () => {
    const portfolio = pf([
      { id: '1', symbol: 'RHM', type: 'BUY', quantity: 2, price: 500, currency: 'EUR', date: '2026-01-01', fxAtTrade },
    ]);
    const [h] = computeHoldings(portfolio, prices, 'EUR');

    // Viewed in EUR, FX never enters: cost 1000 EUR, value 1200 EUR, +200 EUR.
    expect(h.costBasis).toBeCloseTo(1000, 6);
    expect(h.marketValue).toBeCloseTo(1200, 6);
    expect(h.unrealizedPnl).toBeCloseTo(200, 6);
  });
});

describe('convert', () => {
  it('is identity for same currency', () => {
    expect(convert(100, 'USD', 'USD', prices.fx)).toBe(100);
  });
  it('converts EUR to USD via the fx map', () => {
    expect(convert(100, 'EUR', 'USD', prices.fx)).toBeCloseTo(108.6957, 4);
  });
  it('converts USD to TRY', () => {
    expect(convert(100, 'USD', 'TRY', prices.fx)).toBeCloseTo(3250, 6);
  });
});

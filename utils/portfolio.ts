import type { Currency, Holding, PriceData, Portfolio, Transaction } from '../types';
import { getInstrument } from '../data/instruments';
import { convert } from './fx';

/** Sort transactions chronologically (stable on equal dates by array order). */
function chronological(txns: Transaction[]): Transaction[] {
  return txns
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i))
    .map((x) => x.t);
}

interface Position {
  qty: number;
  costBasisNative: number; // native currency invested in the open quantity
  costBasisDisp: number; // display currency invested, locked at trade-date FX
  realizedDisp: number; // display currency banked from sells
  currency?: Currency; // captured from the first transaction for this symbol
}

/**
 * Reduce a portfolio's transactions into per-symbol positions using the
 * average-cost method, valued in `displayCurrency`. Buys add to cost basis
 * (incl. fees) at the trade's locked FX rate; sells bank realized PnL against the
 * running average cost and reduce the basis proportionally. Market value uses
 * today's FX, so cross-currency holdings reflect real currency gains/losses.
 */
export function computeHoldings(
  portfolio: Portfolio,
  prices: PriceData | null,
  displayCurrency: Currency,
): Holding[] {
  const todayFx = prices?.fx ?? { [displayCurrency]: 1 };
  const positions = new Map<string, Position>();

  for (const txn of chronological(portfolio.transactions)) {
    const native = txn.currency;
    // Lock conversions to the FX rate captured at trade time; fall back to today's
    // rate for legacy trades that predate fxAtTrade.
    const tradeFx = txn.fxAtTrade ?? todayFx;
    const toDisplay = (amountNative: number) =>
      convert(amountNative, native, displayCurrency, tradeFx);

    const pos = positions.get(txn.symbol) ?? {
      qty: 0,
      costBasisNative: 0,
      costBasisDisp: 0,
      realizedDisp: 0,
      currency: native,
    };
    const fee = txn.fee ?? 0;

    if (txn.type === 'BUY') {
      const amount = txn.price * txn.quantity + fee;
      pos.costBasisNative += amount;
      pos.costBasisDisp += toDisplay(amount);
      pos.qty += txn.quantity;
    } else {
      const qtySold = Math.min(txn.quantity, pos.qty);
      const avgNative = pos.qty > 0 ? pos.costBasisNative / pos.qty : 0;
      const avgDisp = pos.qty > 0 ? pos.costBasisDisp / pos.qty : 0;
      const costRemovedNative = avgNative * qtySold;
      const costRemovedDisp = avgDisp * qtySold;
      const proceedsNative = txn.price * qtySold - fee;
      // Proceeds are realized at the sell-date FX (the trade's own fxAtTrade).
      pos.realizedDisp += toDisplay(proceedsNative) - costRemovedDisp;
      pos.qty -= qtySold;
      pos.costBasisNative -= costRemovedNative;
      pos.costBasisDisp -= costRemovedDisp;
      if (pos.qty <= 1e-9) {
        pos.qty = 0;
        pos.costBasisNative = 0;
        pos.costBasisDisp = 0;
      }
    }
    positions.set(txn.symbol, pos);
  }

  const holdings: Holding[] = [];
  for (const [symbol, pos] of positions) {
    const inst = getInstrument(symbol);
    const quote = prices?.quotes[symbol];
    // Resolve the native currency / name from the static universe first, then fall
    // back to the trade's own currency or the live quote (covers any added ticker).
    const currency: Currency = inst?.currency ?? pos.currency ?? quote?.currency ?? 'USD';
    const avgCost = pos.qty > 0 ? pos.costBasisNative / pos.qty : 0;

    const holding: Holding = {
      symbol,
      name: inst?.name ?? quote?.name ?? symbol,
      currency,
      quantity: pos.qty,
      avgCost,
      costBasis: pos.costBasisDisp,
      realizedPnl: pos.realizedDisp,
    };

    if (quote && pos.qty > 0) {
      holding.lastPrice = quote.price;
      const marketValue = convert(pos.qty * quote.price, currency, displayCurrency, todayFx);
      holding.marketValue = marketValue;
      holding.unrealizedPnl = marketValue - pos.costBasisDisp;
      holding.unrealizedPct =
        pos.costBasisDisp > 0 ? (holding.unrealizedPnl / pos.costBasisDisp) * 100 : 0;
      if (quote.change != null) {
        holding.dayChange = convert(pos.qty * quote.change, currency, displayCurrency, todayFx);
      }
    }

    holdings.push(holding);
  }

  // Open positions first (by market value desc), then closed ones with realized PnL.
  return holdings.sort((a, b) => {
    if ((b.quantity > 0 ? 1 : 0) !== (a.quantity > 0 ? 1 : 0)) {
      return (b.quantity > 0 ? 1 : 0) - (a.quantity > 0 ? 1 : 0);
    }
    return (b.marketValue ?? 0) - (a.marketValue ?? 0);
  });
}

export interface PortfolioSummary {
  displayCurrency: Currency;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  realizedPnl: number;
  totalPnl: number;
  dayChange: number;
  dayChangePct: number;
  openPositions: number;
}

/**
 * Aggregate holdings (already valued in `displayCurrency` by computeHoldings) into
 * a single summary. Pass the same display currency used to compute the holdings.
 */
export function summarize(holdings: Holding[], displayCurrency: Currency): PortfolioSummary {
  let marketValue = 0;
  let costBasis = 0;
  let unrealizedPnl = 0;
  let realizedPnl = 0;
  let dayChange = 0;
  let openPositions = 0;

  for (const h of holdings) {
    realizedPnl += h.realizedPnl;
    if (h.quantity > 0) {
      openPositions += 1;
      costBasis += h.costBasis;
      if (h.marketValue != null) marketValue += h.marketValue;
      if (h.unrealizedPnl != null) unrealizedPnl += h.unrealizedPnl;
      if (h.dayChange != null) dayChange += h.dayChange;
    }
  }

  const prevValue = marketValue - dayChange;
  return {
    displayCurrency,
    marketValue,
    costBasis,
    unrealizedPnl,
    unrealizedPct: costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0,
    realizedPnl,
    totalPnl: unrealizedPnl + realizedPnl,
    dayChange,
    dayChangePct: prevValue > 0 ? (dayChange / prevValue) * 100 : 0,
    openPositions,
  };
}

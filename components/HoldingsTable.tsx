import React from 'react';
import type { Currency, Holding } from '../types';
import { currencySymbol, formatMoney, formatPct, formatQty, pnlColor } from '../utils/format';
import { ChangePill, PnLValue } from './ui';

interface Props {
  holdings: Holding[];
  display: Currency;
}

const nativePrice = (value: number | undefined, cur: Currency) =>
  value == null
    ? '—'
    : `${currencySymbol(cur)}${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const HoldingsTable: React.FC<Props> = ({ holdings, display }) => {
  const open = holdings.filter((h) => h.quantity > 0);
  const closed = holdings.filter((h) => h.quantity === 0 && h.realizedPnl !== 0);

  if (open.length === 0 && closed.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-paper-300/60">
        No holdings yet. Add a buy below to open your first position.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-paper-300/50">
            <th className="px-5 py-2 font-500">Holding</th>
            <th className="px-3 py-2 font-500 text-right">Qty</th>
            <th className="px-3 py-2 font-500 text-right">Avg cost</th>
            <th className="px-3 py-2 font-500 text-right">Last</th>
            <th className="px-3 py-2 font-500 text-right">Value</th>
            <th className="px-3 py-2 font-500 text-right">Unrealized</th>
            <th className="px-5 py-2 font-500 text-right">Day</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {open.map((h) => {
            const valueDisplay = h.marketValue;
            const pnlDisplay = h.unrealizedPnl;
            return (
              <tr key={h.symbol} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3">
                  <div className="font-600 text-paper-50">{h.symbol}</div>
                  <div className="text-xs text-paper-300/60 truncate max-w-[160px]">{h.name}</div>
                </td>
                <td className="num px-3 py-3 text-right text-paper-200">{formatQty(h.quantity)}</td>
                <td className="num px-3 py-3 text-right text-paper-200">
                  {nativePrice(h.avgCost, h.currency)}
                </td>
                <td className="num px-3 py-3 text-right text-paper-200">
                  {nativePrice(h.lastPrice, h.currency)}
                </td>
                <td className="num px-3 py-3 text-right text-paper-50">
                  {valueDisplay != null ? formatMoney(valueDisplay, display) : '—'}
                </td>
                <td className="num px-3 py-3 text-right">
                  {pnlDisplay != null ? (
                    <span className={pnlColor(pnlDisplay)}>
                      {formatMoney(pnlDisplay, display)}
                      <span className="block text-xs opacity-80">{formatPct(h.unrealizedPct ?? 0)}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {h.dayChange != null && h.marketValue ? (
                    <ChangePill pct={(h.dayChange / (h.marketValue - h.dayChange)) * 100} />
                  ) : (
                    <span className="text-paper-300/40">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        {closed.length > 0 && (
          <tbody className="divide-y divide-white/5 border-t border-white/10">
            {closed.map((h) => (
              <tr key={h.symbol} className="text-paper-300/70">
                <td className="px-5 py-2.5">
                  <span className="font-600">{h.symbol}</span>
                  <span className="ml-2 text-xs text-paper-300/40">closed</span>
                </td>
                <td className="px-3 py-2.5 text-right text-paper-300/40" colSpan={4}>
                  position closed
                </td>
                <td className="num px-3 py-2.5 text-right" colSpan={1}>
                  <span className="text-xs text-paper-300/50">realized </span>
                  <PnLValue amount={h.realizedPnl} currency={display} />
                </td>
                <td className="px-5 py-2.5" />
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
};

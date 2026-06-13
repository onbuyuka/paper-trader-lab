import React from 'react';
import type { Currency } from '../types';
import { formatPct, formatSignedMoney, pnlColor } from '../utils/format';

/** A labelled metric block used across summaries. */
export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}> = ({ label, value, sub, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <span className="text-[11px] uppercase tracking-[0.14em] text-paper-300/60">{label}</span>
    <span className="num text-xl font-display font-600 text-paper-50">{value}</span>
    {sub != null && <span className="num text-xs text-paper-300/70">{sub}</span>}
  </div>
);

/** A coloured signed-money value with an optional percentage. */
export const PnLValue: React.FC<{
  amount: number;
  currency: Currency;
  pct?: number;
  className?: string;
}> = ({ amount, currency, pct, className = '' }) => (
  <span className={`num font-600 ${pnlColor(amount)} ${className}`}>
    {formatSignedMoney(amount, currency)}
    {pct != null && <span className="ml-1 text-xs opacity-80">({formatPct(pct)})</span>}
  </span>
);

/** A small percentage pill, green/red tinted. */
export const ChangePill: React.FC<{ pct: number; className?: string }> = ({ pct, className = '' }) => {
  const tone =
    pct > 0
      ? 'bg-gain-500/15 text-gain-400'
      : pct < 0
        ? 'bg-loss-500/15 text-loss-400'
        : 'bg-white/5 text-paper-300';
  return (
    <span className={`num inline-flex rounded-md px-1.5 py-0.5 text-xs font-600 ${tone} ${className}`}>
      {formatPct(pct)}
    </span>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`rounded-2xl border border-white/5 bg-ink-900/60 shadow-lg shadow-black/20 ${className}`}
  >
    {children}
  </div>
);

const swatch = (color: string) => ({ backgroundColor: color });

export const ColorDot: React.FC<{ color: string; className?: string }> = ({
  color,
  className = '',
}) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} style={swatch(color)} />;

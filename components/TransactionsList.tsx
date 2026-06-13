import React from 'react';
import type { Transaction } from '../types';
import { currencySymbol, formatDate, formatQty } from '../utils/format';
import { useStore } from './PortfolioStore';

interface Props {
  portfolioId: string;
  transactions: Transaction[];
}

export const TransactionsList: React.FC<Props> = ({ portfolioId, transactions }) => {
  const { deleteTransaction } = useStore();

  if (transactions.length === 0) {
    return <p className="px-5 py-6 text-center text-sm text-paper-300/60">No trades logged yet.</p>;
  }

  const ordered = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <ul className="divide-y divide-white/5">
      {ordered.map((t) => {
        const gross = t.quantity * t.price;
        return (
          <li key={t.id} className="group flex items-center gap-3 px-5 py-3 text-sm">
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-700 ${
                t.type === 'BUY' ? 'bg-gain-500/15 text-gain-400' : 'bg-loss-500/15 text-loss-400'
              }`}
            >
              {t.type}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-600 text-paper-50">
                {t.symbol}{' '}
                <span className="num font-400 text-paper-300/70">
                  {formatQty(t.quantity)} @ {currencySymbol(t.currency)}
                  {t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              {t.note && <div className="text-xs text-paper-300/50 truncate">{t.note}</div>}
            </div>
            <div className="text-right">
              <div className="num text-paper-100">
                {currencySymbol(t.currency)}
                {gross.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-paper-300/50">{formatDate(t.date)}</div>
            </div>
            <button
              onClick={() => deleteTransaction(portfolioId, t.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-paper-300/50 hover:text-loss-400"
              title="Delete trade"
              aria-label="Delete trade"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
};

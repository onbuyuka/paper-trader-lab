import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Portfolio } from '../types';
import { computeHoldings, summarize } from '../utils/portfolio';
import { formatMoney } from '../utils/format';
import { usePrices } from './PriceStore';
import { useStore } from './PortfolioStore';
import { ConfirmDialog } from './ConfirmDialog';
import { Card, ChangePill, ColorDot, PnLValue } from './ui';

export const PortfolioCard: React.FC<{ portfolio: Portfolio }> = ({ portfolio }) => {
  const { prices } = usePrices();
  const { state, deletePortfolio } = useStore();
  const display = state.displayCurrency;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const holdings = computeHoldings(portfolio, prices, display);
  const summary = summarize(holdings, display);

  const onDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    setConfirmDelete(true);
  };

  return (
    <>
      <Link to={`/p/${portfolio.id}`} className="block group">
        <Card className="p-5 h-full transition-colors group-hover:border-white/15">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ColorDot color={portfolio.color} />
              <h3 className="font-display font-600 text-paper-50 truncate">{portfolio.name}</h3>
            </div>
            <button
              onClick={onDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-paper-300/60 hover:text-loss-400 text-sm"
              title="Delete portfolio"
              aria-label="Delete portfolio"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <div className="num text-2xl font-display font-700 text-paper-50">
                {formatMoney(summary.marketValue, display)}
              </div>
              <div className="mt-1">
                <PnLValue
                  amount={summary.totalPnl}
                  currency={display}
                  pct={summary.costBasis > 0 ? (summary.totalPnl / summary.costBasis) * 100 : undefined}
                />
              </div>
            </div>
            {summary.openPositions > 0 && <ChangePill pct={summary.dayChangePct} />}
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs text-paper-300/60">
            <span>
              {summary.openPositions} position{summary.openPositions === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>{portfolio.transactions.length} trades</span>
            {summary.realizedPnl !== 0 && (
              <>
                <span>·</span>
                <span>
                  realized <PnLValue amount={summary.realizedPnl} currency={display} />
                </span>
              </>
            )}
          </div>
        </Card>
      </Link>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete portfolio"
        message={
          <>
            Delete <span className="font-600 text-paper-50">{portfolio.name}</span>? This can't be
            undone — export first if you want to keep a copy.
          </>
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => deletePortfolio(portfolio.id)}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
};

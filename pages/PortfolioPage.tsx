import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { computeHoldings, summarize } from '../utils/portfolio';
import { formatMoney } from '../utils/format';
import { usePrices } from '../components/PriceStore';
import { useStore } from '../components/PortfolioStore';
import { AddTradeForm } from '../components/AddTradeForm';
import { HoldingsTable } from '../components/HoldingsTable';
import { TransactionsList } from '../components/TransactionsList';
import { PortfolioNameDialog } from '../components/PortfolioNameDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Card, ColorDot, PnLValue, Stat } from '../components/ui';

export const PortfolioPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { prices } = usePrices();
  const { state, getPortfolio, renamePortfolio, deletePortfolio, duplicatePortfolio } = useStore();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const portfolio = getPortfolio(id);
  const display = state.displayCurrency;

  if (!portfolio) {
    return (
      <div className="py-16 text-center">
        <p className="text-paper-200">That portfolio doesn't exist.</p>
        <Link to="/" className="mt-2 inline-block text-brandx-400 hover:underline">
          ← Back to portfolios
        </Link>
      </div>
    );
  }

  const holdings = computeHoldings(portfolio, prices, display);
  const summary = summarize(holdings, display);

  const onDelete = () => {
    setConfirmDelete(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-paper-300/70 hover:text-paper-50">
          ← Portfolios
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            onClick={() => setRenaming(true)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-paper-200 hover:bg-white/10"
          >
            Rename
          </button>
          <button
            onClick={() => {
              const newId = duplicatePortfolio(portfolio.id);
              if (newId) navigate(`/p/${newId}`);
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-paper-200 hover:bg-white/10"
          >
            Duplicate
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-loss-500/30 bg-loss-500/10 px-3 py-1.5 text-loss-400 hover:bg-loss-500/20"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ColorDot color={portfolio.color} className="h-3 w-3" />
        <h1 className="font-display font-700 text-2xl text-paper-50">{portfolio.name}</h1>
      </div>
      {portfolio.note && <p className="-mt-3 text-sm text-paper-300/70">{portfolio.note}</p>}

      {/* Summary */}
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Market value" value={formatMoney(summary.marketValue, display)} />
          <Stat label="Invested" value={formatMoney(summary.costBasis, display)} />
          <Stat
            label="Total PnL"
            value={<PnLValue amount={summary.totalPnl} currency={display} />}
            sub={summary.costBasis > 0 ? `${((summary.totalPnl / summary.costBasis) * 100).toFixed(2)}%` : undefined}
          />
          <Stat
            label="Unrealized"
            value={<PnLValue amount={summary.unrealizedPnl} currency={display} />}
            sub={`${summary.unrealizedPct.toFixed(2)}%`}
          />
          <Stat label="Realized" value={<PnLValue amount={summary.realizedPnl} currency={display} />} />
          <Stat
            label="Day change"
            value={<PnLValue amount={summary.dayChange} currency={display} />}
            sub={`${summary.dayChangePct.toFixed(2)}%`}
          />
        </div>
      </Card>

      {/* Holdings */}
      <Card>
        <div className="border-b border-white/5 px-5 py-3">
          <h2 className="font-display font-600 text-paper-50">Holdings</h2>
        </div>
        <HoldingsTable holdings={holdings} display={display} />
      </Card>

      {/* Add trade + transactions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display font-600 text-paper-50">Log a trade</h2>
          <AddTradeForm portfolioId={portfolio.id} />
        </Card>
        <Card>
          <div className="border-b border-white/5 px-5 py-3">
            <h2 className="font-display font-600 text-paper-50">
              Trades{' '}
              <span className="text-sm font-400 text-paper-300/60">
                ({portfolio.transactions.length})
              </span>
            </h2>
          </div>
          <TransactionsList portfolioId={portfolio.id} transactions={portfolio.transactions} />
        </Card>
      </div>

      <PortfolioNameDialog
        open={renaming}
        title="Rename portfolio"
        confirmLabel="Save"
        initialValue={portfolio.name}
        onSubmit={(name) => renamePortfolio(portfolio.id, name)}
        onClose={() => setRenaming(false)}
      />

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
        onConfirm={() => {
          deletePortfolio(portfolio.id);
          navigate('/');
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
};

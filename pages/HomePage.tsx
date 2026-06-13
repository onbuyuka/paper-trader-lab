import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../components/PortfolioStore';
import { PortfolioCard } from '../components/PortfolioCard';
import { ImportExport } from '../components/ImportExport';
import { PortfolioNameDialog } from '../components/PortfolioNameDialog';
import { Card } from '../components/ui';

export const HomePage: React.FC = () => {
  const { state, createPortfolio } = useStore();
  const navigate = useNavigate();
  const [naming, setNaming] = useState(false);

  const onCreate = (name: string) => {
    const id = createPortfolio(name);
    navigate(`/p/${id}`);
  };

  return (
    <div className="space-y-12">
      <section className="animate-fade-in-up">
        <h1 className="font-display font-700 text-3xl sm:text-4xl text-paper-50 tracking-tight">
          Build portfolios on paper.{' '}
          <span className="text-brandx-400">Watch the PnL, risk-free.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-paper-300/80 leading-relaxed">
          Spin up hypothetical portfolios, log buys and sells with paper money, and track profit
          and loss against a daily price snapshot. Pit alternative portfolios against each other,
          learn what moves them, and build conviction before a single real euro is at stake.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setNaming(true)}
            className="rounded-lg bg-brandx-500 px-4 py-2 text-sm font-600 text-white hover:bg-brandx-600 transition-colors"
          >
            + New portfolio
          </button>
          <ImportExport />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-600 text-lg text-paper-50">Your portfolios</h2>
          <span className="text-xs text-paper-300/60">{state.portfolios.length} total</span>
        </div>

        {state.portfolios.length === 0 ? (
          <Card className="mt-4 p-8 text-center">
            <p className="text-paper-200">No portfolios yet.</p>
            <p className="mt-1 text-sm text-paper-300/70">
              Start one from scratch above to begin tracking your paper PnL.
            </p>
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.portfolios.map((p) => (
              <PortfolioCard key={p.id} portfolio={p} />
            ))}
          </div>
        )}
      </section>

      <PortfolioNameDialog
        open={naming}
        title="Name your paper portfolio"
        confirmLabel="Create"
        initialValue={`Portfolio ${state.portfolios.length + 1}`}
        onSubmit={onCreate}
        onClose={() => setNaming(false)}
      />
    </div>
  );
};

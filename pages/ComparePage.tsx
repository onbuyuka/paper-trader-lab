import React from 'react';
import { Link } from 'react-router-dom';
import type { Portfolio } from '../types';
import { computeHoldings, summarize, type PortfolioSummary } from '../utils/portfolio';
import { formatMoney, formatPct, pnlColor } from '../utils/format';
import { usePrices } from '../components/PriceStore';
import { useStore } from '../components/PortfolioStore';
import { Card, ColorDot } from '../components/ui';

interface Row {
  portfolio: Portfolio;
  summary: PortfolioSummary;
  returnPct: number;
}

export const ComparePage: React.FC = () => {
  const { prices } = usePrices();
  const { state } = useStore();
  const display = state.displayCurrency;

  const rows: Row[] = state.portfolios.map((portfolio) => {
    const holdings = computeHoldings(portfolio, prices, display);
    const summary = summarize(holdings, display);
    const returnPct = summary.costBasis > 0 ? (summary.totalPnl / summary.costBasis) * 100 : 0;
    return { portfolio, summary, returnPct };
  });

  const ranked = [...rows].sort((a, b) => b.returnPct - a.returnPct);
  const maxReturn = Math.max(1, ...rows.map((r) => Math.abs(r.returnPct)));
  const maxValue = Math.max(1, ...rows.map((r) => r.summary.marketValue));

  if (state.portfolios.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-paper-200">Nothing to compare yet.</p>
        <Link to="/" className="mt-2 inline-block text-brandx-400 hover:underline">
          ← Create a portfolio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display font-700 text-2xl text-paper-50">Compare portfolios</h1>
        <p className="mt-1 text-sm text-paper-300/70">
          Every portfolio side by side, valued in {display}. Clash your ideas and see which one is
          actually pulling ahead.
        </p>
      </div>

      {/* Return leaderboard */}
      <Card className="p-5">
        <h2 className="mb-4 font-display font-600 text-paper-50">Total return</h2>
        <div className="space-y-3">
          {ranked.map(({ portfolio, returnPct }) => (
            <Link key={portfolio.id} to={`/p/${portfolio.id}`} className="block group">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex w-40 min-w-0 items-center gap-2">
                  <ColorDot color={portfolio.color} />
                  <span className="truncate text-paper-200 group-hover:text-paper-50">
                    {portfolio.name}
                  </span>
                </div>
                <div className="relative flex-1">
                  <div className="h-6 rounded-md bg-white/5">
                    <div
                      className={`h-6 rounded-md ${returnPct >= 0 ? 'bg-gain-500/60' : 'bg-loss-500/60'}`}
                      style={{ width: `${(Math.abs(returnPct) / maxReturn) * 100}%` }}
                    />
                  </div>
                </div>
                <span className={`num w-20 text-right font-600 ${pnlColor(returnPct)}`}>
                  {formatPct(returnPct)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Detail table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-paper-300/50">
                <th className="px-5 py-3 font-500">Portfolio</th>
                <th className="px-3 py-3 font-500 text-right">Value</th>
                <th className="px-3 py-3 font-500 text-right">Invested</th>
                <th className="px-3 py-3 font-500 text-right">Total PnL</th>
                <th className="px-3 py-3 font-500 text-right">Return</th>
                <th className="px-5 py-3 font-500 text-right">Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map(({ portfolio, summary, returnPct }) => (
                <tr key={portfolio.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <Link to={`/p/${portfolio.id}`} className="flex items-center gap-2">
                      <ColorDot color={portfolio.color} />
                      <span className="text-paper-100 hover:text-paper-50">{portfolio.name}</span>
                    </Link>
                  </td>
                  <td className="num px-3 py-3 text-right text-paper-50">
                    {formatMoney(summary.marketValue, display)}
                  </td>
                  <td className="num px-3 py-3 text-right text-paper-300/80">
                    {formatMoney(summary.costBasis, display)}
                  </td>
                  <td className={`num px-3 py-3 text-right ${pnlColor(summary.totalPnl)}`}>
                    {formatMoney(summary.totalPnl, display)}
                  </td>
                  <td className={`num px-3 py-3 text-right font-600 ${pnlColor(returnPct)}`}>
                    {formatPct(returnPct)}
                  </td>
                  <td className={`num px-5 py-3 text-right ${pnlColor(summary.dayChangePct)}`}>
                    {formatPct(summary.dayChangePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Value comparison */}
      <Card className="p-5">
        <h2 className="mb-4 font-display font-600 text-paper-50">Market value</h2>
        <div className="space-y-3">
          {rows.map(({ portfolio, summary }) => (
            <div key={portfolio.id} className="flex items-center gap-3 text-sm">
              <div className="flex w-40 min-w-0 items-center gap-2">
                <ColorDot color={portfolio.color} />
                <span className="truncate text-paper-200">{portfolio.name}</span>
              </div>
              <div className="relative flex-1">
                <div className="h-6 rounded-md bg-white/5">
                  <div
                    className="h-6 rounded-md"
                    style={{
                      width: `${(summary.marketValue / maxValue) * 100}%`,
                      backgroundColor: portfolio.color,
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
              <span className="num w-28 text-right text-paper-100">
                {formatMoney(summary.marketValue, display)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { CURRENCIES } from '../types';
import { useStore } from './PortfolioStore';
import { PriceStatus } from './PriceStatus';

const navItem =
  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, setDisplayCurrency } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl" aria-hidden>📈</span>
            <span className="flex flex-col leading-none">
              <span className="font-display font-700 text-paper-50 tracking-tight">
                Paper Trader Lab
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-paper-300/70">
                paper money · no real trades
              </span>
            </span>
          </Link>

          <nav className="ml-2 hidden sm:flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${navItem} ${isActive ? 'bg-white/10 text-paper-50' : 'text-paper-300 hover:text-paper-50 hover:bg-white/5'}`
              }
            >
              Portfolios
            </NavLink>
            <NavLink
              to="/compare"
              className={({ isActive }) =>
                `${navItem} ${isActive ? 'bg-white/10 text-paper-50' : 'text-paper-300 hover:text-paper-50 hover:bg-white/5'}`
              }
            >
              Compare
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <PriceStatus />

            <div className="flex items-center rounded-lg bg-white/5 p-0.5">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setDisplayCurrency(c)}
                  className={`px-2.5 py-1 rounded-md text-xs font-600 transition-colors ${
                    state.displayCurrency === c
                      ? 'bg-brandx-500 text-white'
                      : 'text-paper-300 hover:text-paper-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>

      <footer className="border-t border-white/5 py-6">
        <div className="mx-auto max-w-6xl px-4 text-xs text-paper-300/60 flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>
            Educational paper-trading sandbox. Not investment advice. Prices may be delayed or
            approximate.
          </span>
          <span>Data stays in your browser · export anytime</span>
        </div>
      </footer>
    </div>
  );
};

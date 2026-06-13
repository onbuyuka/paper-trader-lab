import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppState, Currency, Portfolio, Transaction } from '../types';
import { uid } from '../utils/id';
import { defaultState, loadState, saveState } from '../utils/storage';

type NewTransaction = Omit<Transaction, 'id'>;

interface StoreApi {
  state: AppState;
  getPortfolio: (id: string) => Portfolio | undefined;
  createPortfolio: (name: string, color?: string, note?: string) => string;
  renamePortfolio: (id: string, name: string) => void;
  setPortfolioNote: (id: string, note: string) => void;
  deletePortfolio: (id: string) => void;
  duplicatePortfolio: (id: string) => string | undefined;
  addTransaction: (portfolioId: string, txn: NewTransaction) => void;
  deleteTransaction: (portfolioId: string, txnId: string) => void;
  setDisplayCurrency: (c: Currency) => void;
  replaceState: (next: AppState) => void;
  mergeState: (incoming: AppState) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#14b8a6', '#ec4899'];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const updatePortfolio = useCallback(
    (id: string, fn: (p: Portfolio) => Portfolio) => {
      setState((s) => ({
        ...s,
        portfolios: s.portfolios.map((p) => (p.id === id ? fn(p) : p)),
      }));
    },
    [],
  );

  const getPortfolio = useCallback(
    (id: string) => state.portfolios.find((p) => p.id === id),
    [state.portfolios],
  );

  const createPortfolio = useCallback((name: string, color?: string, note?: string) => {
    const id = uid('pf');
    setState((s) => ({
      ...s,
      portfolios: [
        ...s.portfolios,
        {
          id,
          name: name.trim() || `Portfolio ${s.portfolios.length + 1}`,
          color: color ?? PALETTE[s.portfolios.length % PALETTE.length],
          createdAt: new Date().toISOString(),
          note,
          transactions: [],
        },
      ],
    }));
    return id;
  }, []);

  const renamePortfolio = useCallback(
    (id: string, name: string) => updatePortfolio(id, (p) => ({ ...p, name: name.trim() || p.name })),
    [updatePortfolio],
  );

  const setPortfolioNote = useCallback(
    (id: string, note: string) => updatePortfolio(id, (p) => ({ ...p, note })),
    [updatePortfolio],
  );

  const deletePortfolio = useCallback((id: string) => {
    setState((s) => ({ ...s, portfolios: s.portfolios.filter((p) => p.id !== id) }));
  }, []);

  const duplicatePortfolio = useCallback(
    (id: string) => {
      const source = state.portfolios.find((p) => p.id === id);
      if (!source) return undefined;
      const newId = uid('pf');
      setState((s) => ({
        ...s,
        portfolios: [
          ...s.portfolios,
          {
            ...source,
            id: newId,
            name: `${source.name} (copy)`,
            createdAt: new Date().toISOString(),
            transactions: source.transactions.map((t) => ({ ...t, id: uid('tx') })),
          },
        ],
      }));
      return newId;
    },
    [state.portfolios],
  );

  const addTransaction = useCallback(
    (portfolioId: string, txn: NewTransaction) => {
      updatePortfolio(portfolioId, (p) => ({
        ...p,
        transactions: [...p.transactions, { ...txn, id: uid('tx') }],
      }));
    },
    [updatePortfolio],
  );

  const deleteTransaction = useCallback(
    (portfolioId: string, txnId: string) => {
      updatePortfolio(portfolioId, (p) => ({
        ...p,
        transactions: p.transactions.filter((t) => t.id !== txnId),
      }));
    },
    [updatePortfolio],
  );

  const setDisplayCurrency = useCallback((c: Currency) => {
    setState((s) => ({ ...s, displayCurrency: c }));
  }, []);

  const replaceState = useCallback((next: AppState) => setState(next), []);

  const mergeState = useCallback((incoming: AppState) => {
    setState((s) => {
      const existingIds = new Set(s.portfolios.map((p) => p.id));
      const merged = incoming.portfolios.map((p) =>
        existingIds.has(p.id) ? { ...p, id: uid('pf') } : p,
      );
      return { ...s, portfolios: [...s.portfolios, ...merged] };
    });
  }, []);

  const resetAll = useCallback(() => setState(defaultState()), []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      getPortfolio,
      createPortfolio,
      renamePortfolio,
      setPortfolioNote,
      deletePortfolio,
      duplicatePortfolio,
      addTransaction,
      deleteTransaction,
      setDisplayCurrency,
      replaceState,
      mergeState,
      resetAll,
    }),
    [
      state,
      getPortfolio,
      createPortfolio,
      renamePortfolio,
      setPortfolioNote,
      deletePortfolio,
      duplicatePortfolio,
      addTransaction,
      deleteTransaction,
      setDisplayCurrency,
      replaceState,
      mergeState,
      resetAll,
    ],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}

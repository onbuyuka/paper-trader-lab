import type { AppState, Currency, Portfolio } from '../types';
import { CURRENCIES } from '../types';

export const STORAGE_KEY = 'paper-trader-lab:v1';
export const STATE_VERSION = 1;

export function defaultState(): AppState {
  return { version: STATE_VERSION, portfolios: [], displayCurrency: 'USD' };
}

/** Load state from localStorage, tolerating absence or corruption. */
export function loadState(): AppState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full / blocked — non-fatal for a paper app
  }
}

/** Coerce arbitrary parsed JSON into a valid AppState (drops bad rows). */
export function normalizeState(input: unknown): AppState {
  const obj = (input ?? {}) as Partial<AppState>;
  const displayCurrency: Currency = CURRENCIES.includes(obj.displayCurrency as Currency)
    ? (obj.displayCurrency as Currency)
    : 'USD';

  const portfolios: Portfolio[] = Array.isArray(obj.portfolios)
    ? obj.portfolios.filter(isPortfolioLike).map(normalizePortfolio)
    : [];

  return { version: STATE_VERSION, portfolios, displayCurrency };
}

function isPortfolioLike(p: unknown): p is Portfolio {
  return !!p && typeof p === 'object' && typeof (p as Portfolio).id === 'string';
}

function normalizePortfolio(p: Portfolio): Portfolio {
  return {
    id: p.id,
    name: typeof p.name === 'string' ? p.name : 'Untitled',
    color: typeof p.color === 'string' ? p.color : '#3b82f6',
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    note: typeof p.note === 'string' ? p.note : undefined,
    transactions: Array.isArray(p.transactions)
      ? p.transactions.filter(
          (t) =>
            t &&
            typeof t.symbol === 'string' &&
            (t.type === 'BUY' || t.type === 'SELL') &&
            isFinite(t.quantity) &&
            isFinite(t.price),
        )
      : [],
  };
}

interface ExportEnvelope {
  app: 'paper-trader-lab';
  version: number;
  exportedAt: string;
  state: AppState;
}

/** Serialize state into a downloadable, version-stamped JSON string. */
export function exportState(state: AppState): string {
  const envelope: ExportEnvelope = {
    app: 'paper-trader-lab',
    version: STATE_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

/** Parse an imported JSON string, accepting either a raw state or an envelope. */
export function parseImport(text: string): AppState {
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === 'object' && 'state' in parsed) {
    return normalizeState((parsed as ExportEnvelope).state);
  }
  return normalizeState(parsed);
}

import type { Currency } from '../types';

const SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  TRY: '₺',
  GBP: '£',
  DKK: 'kr',
};

const LOCALES: Record<Currency, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  TRY: 'tr-TR',
  GBP: 'en-GB',
  DKK: 'da-DK',
};

export function currencySymbol(currency: Currency): string {
  return SYMBOLS[currency] ?? currency;
}

/** Format an amount as money in the given currency. */
export function formatMoney(amount: number, currency: Currency, maxFrac = 2): string {
  if (!isFinite(amount)) return '—';
  return new Intl.NumberFormat(LOCALES[currency] ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(amount);
}

/** Compact money for tight spots (e.g. $1.2M). */
export function formatMoneyCompact(amount: number, currency: Currency): string {
  if (!isFinite(amount)) return '—';
  return new Intl.NumberFormat(LOCALES[currency] ?? 'en-US', {
    style: 'currency',
    currency,
    notation: Math.abs(amount) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(amount);
}

/** A signed amount with an explicit + / − and money formatting. */
export function formatSignedMoney(amount: number, currency: Currency): string {
  if (!isFinite(amount)) return '—';
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return `${sign}${formatMoney(Math.abs(amount), currency)}`;
}

/** A signed percentage, e.g. +12.34% / −5.00%. */
export function formatPct(pct: number, digits = 2): string {
  if (!isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}

/** A plain quantity (up to 4 dp, trailing zeros trimmed). */
export function formatQty(qty: number): string {
  if (!isFinite(qty)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(qty);
}

/** Tailwind text colour class for a gain / loss / flat value. */
export function pnlColor(value: number): string {
  if (value > 0) return 'text-gain-400';
  if (value < 0) return 'text-loss-400';
  return 'text-paper-300';
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

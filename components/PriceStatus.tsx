import React, { useEffect, useRef, useState } from 'react';
import { usePrices } from './PriceStore';

/**
 * The header price-status pill (Live / Snapshot / Loading / error) with an
 * explanatory popover on hover and click. Clicking pins the popover open so the
 * user can read it and hit "Refresh now"; it closes on outside-click or Escape.
 */
export const PriceStatus: React.FC = () => {
  const { isLive, loading, refreshing, error, asOf, prices, refreshLive } = usePrices();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);

  const asOfDate = asOf ? new Date(asOf) : null;

  const statusLabel = error
    ? 'Price feed issue'
    : refreshing
      ? 'Updating prices…'
      : isLive
        ? `Live · ${asOfDate?.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : asOfDate
          ? `Snapshot ${asOfDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
          : loading
            ? 'Loading prices…'
            : 'No prices';

  const dotClass =
    refreshing || loading
      ? 'bg-amber-400 animate-pulse'
      : error
        ? 'bg-loss-500'
        : isLive
          ? 'bg-gain-500'
          : 'bg-paper-300/50';

  const headline = error
    ? 'Price feed issue'
    : refreshing
      ? 'Updating prices…'
      : isLive
        ? 'Live prices'
        : asOfDate
          ? 'Daily snapshot'
          : loading
            ? 'Loading prices…'
            : 'No prices yet';

  const description = error
    ? `Couldn't reach the live feed (${error}). Showing the last saved snapshot instead.`
    : isLive
      ? 'Some quotes were just fetched live in your browser and layered over the daily snapshot.'
      : 'Prices come from the daily end-of-day snapshot below.';

  const fullStamp = asOfDate?.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const quoteCount = prices ? Object.keys(prices.quotes).length : 0;

  const show = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setOpen(true);
  };
  const scheduleHide = () => {
    if (pinned) return;
    hideTimer.current = window.setTimeout(() => setOpen(false), 140);
  };
  const toggle = () => {
    if (pinned) {
      setPinned(false);
      setOpen(false);
    } else {
      setPinned(true);
      setOpen(true);
    }
  };

  // Close the pinned popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative hidden md:block"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs text-paper-300/80 hover:text-paper-50 transition-colors"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {statusLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Price data details"
          className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-white/10 bg-ink-900 p-4 text-left shadow-2xl shadow-black/50 animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <h3 className="font-display font-600 text-sm text-paper-50">{headline}</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-paper-300/80">{description}</p>

          <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-xs text-paper-300/70">
            <div className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gain-500" />
              <span>
                <span className="font-600 text-paper-200">Live</span> — quotes fetched in your
                browser for held tickers that aren't in the snapshot, layered on top.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-paper-300/50" />
              <span>
                <span className="font-600 text-paper-200">Snapshot</span> — the daily end-of-day
                price file, refreshed after the US close. Reliable baseline, works offline.
              </span>
            </div>
          </div>

          {asOfDate && (
            <p className="mt-3 text-[11px] text-paper-300/50">
              Updated {fullStamp} · {quoteCount} instruments
            </p>
          )}
          <p className="mt-1 text-[11px] leading-relaxed text-paper-300/50">
            Real data from Yahoo Finance. Prices are last close (not real-time); FX is daily.
          </p>

          <button
            onClick={() => refreshLive()}
            disabled={refreshing}
            className="mt-3 w-full rounded-lg bg-brandx-500 px-3 py-1.5 text-xs font-600 text-white hover:bg-brandx-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {refreshing ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      )}
    </div>
  );
};

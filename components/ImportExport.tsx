import React, { useRef, useState } from 'react';
import type { AppState } from '../types';
import { useStore } from './PortfolioStore';
import { exportState, parseImport } from '../utils/storage';
import { Modal } from './Modal';

export const ImportExport: React.FC = () => {
  const { state, replaceState, mergeState } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ incoming: AppState; count: number } | null>(null);

  const onExport = () => {
    const json = exportState(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `paper-trader-lab-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Exported your portfolios.');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = parseImport(text);
      const count = incoming.portfolios.length;
      if (count === 0) {
        setMsg('That file had no portfolios.');
        return;
      }
      // Nothing here yet — just load it. Otherwise ask how to combine.
      if (state.portfolios.length === 0) {
        replaceState(incoming);
        setMsg(`Imported ${count} portfolio(s).`);
      } else {
        setPending({ incoming, count });
      }
    } catch {
      setMsg('Could not read that file — is it a Paper Trader Lab export?');
    }
  };

  const onReplace = () => {
    if (!pending) return;
    replaceState(pending.incoming);
    setMsg(`Imported ${pending.count} portfolio(s) (replaced).`);
    setPending(null);
  };

  const onMerge = () => {
    if (!pending) return;
    mergeState(pending.incoming);
    setMsg(`Imported ${pending.count} portfolio(s) (merged).`);
    setPending(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onExport}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-500 text-paper-100 hover:bg-white/10 transition-colors"
      >
        Export
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-500 text-paper-100 hover:bg-white/10 transition-colors"
      >
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="hidden"
      />
      {msg && <span className="text-xs text-paper-300/70">{msg}</span>}

      <Modal open={pending != null} onClose={() => setPending(null)} title="Import portfolios">
        <p className="mt-3 text-sm text-paper-200/90 leading-relaxed">
          This file has{' '}
          <span className="font-600 text-paper-50">{pending?.count} portfolio(s)</span>. You already
          have <span className="font-600 text-paper-50">{state.portfolios.length}</span>. How should
          we bring them in?
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-500 text-paper-200 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onMerge}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-600 text-paper-100 hover:bg-white/10 transition-colors"
          >
            Merge (keep mine)
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded-lg bg-loss-600 px-4 py-1.5 text-sm font-600 text-white hover:bg-loss-500 transition-colors"
          >
            Replace everything
          </button>
        </div>
      </Modal>
    </div>
  );
};

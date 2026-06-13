import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialValue?: string;
  placeholder?: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** A focused modal for naming or renaming a portfolio. */
export const PortfolioNameDialog: React.FC<Props> = ({
  open,
  title,
  confirmLabel,
  initialValue = '',
  placeholder = 'Portfolio name',
  onSubmit,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the field to the latest initial value each time the dialog opens, then
  // focus and select it so the user can type or overwrite immediately.
  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    onSubmit(name);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={60}
          className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-paper-50 focus:border-brandx-500 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-500 text-paper-200 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-lg bg-brandx-500 px-4 py-1.5 text-sm font-600 text-white hover:bg-brandx-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
};

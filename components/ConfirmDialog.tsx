import React, { useEffect, useRef } from 'react';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onClose: () => void;
}

/** A styled confirm dialog replacing window.confirm(). */
export const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onClose,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => confirmRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const confirmClasses =
    tone === 'danger'
      ? 'bg-loss-600 hover:bg-loss-500 text-white'
      : 'bg-brandx-500 hover:bg-brandx-600 text-white';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mt-3 text-sm text-paper-200/90 leading-relaxed">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-500 text-paper-200 hover:bg-white/10 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-lg px-4 py-1.5 text-sm font-600 transition-colors ${confirmClasses}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

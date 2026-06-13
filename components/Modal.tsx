import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional id of the element labelling the dialog (falls back to the title). */
  labelledBy?: string;
}

/**
 * A small accessible modal: backdrop + centered panel, rendered into <body> so it
 * sits above the sticky header. Closes on Escape and backdrop click, locks body
 * scroll while open, and restores focus to the previously focused element.
 */
export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, labelledBy }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy ?? (title ? 'modal-title' : undefined)}
    >
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-2xl shadow-black/50 animate-pop"
      >
        {title && (
          <h2 id="modal-title" className="font-display font-600 text-lg text-paper-50">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
};

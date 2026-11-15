'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Accessible dialog: Escape and backdrop close it, focus moves in and is restored
 * on close, Tab is trapped, and body scroll is locked while open.
 */
export function Modal({
  open, onClose, title, description, children, footer, className,
}: {
  open: boolean; onClose: () => void; title: string; description?: string;
  children?: ReactNode; footer?: ReactNode; className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            className="absolute inset-0 bg-canvas/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            className={cn('relative w-full max-w-md rounded-panel border border-line-strong bg-raised shadow-raise outline-none', className)}
            initial={reduce ? false : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <h2 id={titleId} className="text-base font-medium text-ink">{title}</h2>
                {description && <p className="mt-1 text-sm text-ink-dim">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-dim hover:bg-overlay hover:text-ink">
                <X size={16} />
              </button>
            </div>
            {children && <div className="px-5 py-4">{children}</div>}
            {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

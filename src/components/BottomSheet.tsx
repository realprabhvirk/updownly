import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon';

/**
 * Modal bottom sheet (centred card on wide screens). Escape or the scrim
 * closes it; focus moves in on open, is kept inside, and is restored on close.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  children,
  variant = 'sheet',
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ComponentChildren;
  variant?: 'sheet' | 'dialog';
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add('sheet-open');
    const t = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
      first?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Handled here only: don't let the game screen also react to it.
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('sheet-open');
      restore.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div class={`sheet-root sheet-${variant}`}>
      <div class="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div class="sheet-panel" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panel}>
        {variant === 'sheet' && <div class="sheet-grabber" aria-hidden="true" />}
        {variant === 'sheet' && (
          <button type="button" class="sheet-close icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Small confirmation dialog for destructive or game-ending actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onCancel} label={title} variant="dialog">
      <div class="dialog-body">
        <h2 class="dialog-title">{title}</h2>
        <p class="dialog-message">{message}</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="dialog-btn" onClick={onCancel} data-autofocus>
          {cancelLabel}
        </button>
        <button type="button" class={`dialog-btn ${destructive ? 'is-destructive' : 'is-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

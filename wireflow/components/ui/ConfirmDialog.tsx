'use client';

import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Trap focus within dialog
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusableElements = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }, []);

  if (!isOpen) return null;

  const Icon = variant === 'danger' ? Trash2 : AlertTriangle;

  const iconColors = {
    danger: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50',
    default: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50',
  }[variant];

  const confirmButtonColors = {
    danger: 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 text-white',
    default: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white',
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 animate-fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in"
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconColors}`}>
            <Icon size={24} />
          </div>

          {/* Title */}
          <h2
            id="dialog-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2"
          >
            {title}
          </h2>

          {/* Message */}
          <p
            id="dialog-description"
            className="text-sm text-zinc-600 dark:text-zinc-400 mb-6"
          >
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${confirmButtonColors}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

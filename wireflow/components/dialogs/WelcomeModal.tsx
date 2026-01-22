'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { useFocusRestore } from '@/lib/useFocusRestore';

const WELCOME_SHOWN_KEY = 'wireflow-welcome-shown';

/** Reset the "don't show again" preference so the welcome modal appears again */
export function resetWelcomePreference(): void {
  localStorage.removeItem(WELCOME_SHOWN_KEY);
}

interface WelcomeModalProps {
  /** External trigger to open the modal (used for manual re-open) */
  externalOpen?: boolean;
  /** Callback when modal is closed */
  onClose?: () => void;
}

export function WelcomeModal({ externalOpen, onClose }: WelcomeModalProps) {
  const [autoShowOpen, setAutoShowOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // Modal is open if auto-show triggered OR external open triggered
  const isOpen = autoShowOpen || (externalOpen ?? false);

  // Restore focus to previously focused element when modal closes
  useFocusRestore(isOpen);

  useEffect(() => {
    // Auto-show for first-time users (only if not already suppressed)
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY);
    if (!hasSeenWelcome) {
      setAutoShowOpen(true);
    }
  }, []);

  // Auto-focus the "Start creating" button when modal opens
  useEffect(() => {
    if (isOpen && startButtonRef.current) {
      startButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    // Only save preference if checkbox is checked
    if (dontShowAgain) {
      localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
    }
    // Close both internal and external state
    setAutoShowOpen(false);
    onClose?.();
  }, [dontShowAgain, onClose]);

  // Focus trap
  useFocusTrap(modalRef, isOpen);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-lg mx-4 overflow-hidden animate-scale-in"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close welcome dialog"
        >
          <X size={18} />
        </button>

        {/* Content */}
        <div className="p-6">
          <h2
            id="welcome-title"
            className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2"
          >
            Welcome to WireFlow
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            A freeform wireframing tool for quick sketching.
          </p>

          {/* Quick tips */}
          <div className="space-y-3 mb-6">
            <Tip
              shortcut="V, R, O, D, A, L, P, T"
              description="Select, Rectangle, Ellipse, Diamond, Arrow, Line, Pencil, Text tools"
            />
            <Tip
              shortcut="Ctrl/⌘ + Z"
              description="Undo your last change"
            />
            <Tip
              shortcut="Ctrl/⌘ + Y"
              description="Redo your last change"
            />
            <Tip
              shortcut="Delete / Backspace"
              description="Delete selected elements"
            />
            <Tip
              shortcut="?"
              description="View all keyboard shortcuts"
            />
          </div>

          {/* CTA */}
          <button
            ref={startButtonRef}
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Start creating
            <ArrowRight size={18} />
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
          <label className="flex items-center justify-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Don&apos;t show this again
            </span>
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
            Press <kbd className="px-1.5 py-0.5 font-mono bg-zinc-200 dark:bg-zinc-700 rounded">?</kbd> anytime to see keyboard shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}

function Tip({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <kbd className="shrink-0 px-2 py-1 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700">
        {shortcut}
      </kbd>
      <span className="text-sm text-zinc-600 dark:text-zinc-400 pt-0.5">
        {description}
      </span>
    </div>
  );
}

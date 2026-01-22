'use client';

import { useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/lib/useFocusTrap';

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Tools',
    shortcuts: [
      { keys: 'V', description: 'Select tool' },
      { keys: 'R', description: 'Rectangle tool' },
      { keys: 'O', description: 'Ellipse tool' },
      { keys: 'D', description: 'Diamond tool' },
      { keys: 'A', description: 'Arrow tool' },
      { keys: 'L', description: 'Line tool' },
      { keys: 'P', description: 'Pencil (freedraw) tool' },
      { keys: 'T', description: 'Text tool' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: 'Ctrl/⌘ + A', description: 'Select all elements' },
      { keys: 'Escape', description: 'Deselect all' },
      { keys: 'Delete / Backspace', description: 'Delete selected element' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: 'Ctrl/⌘ + Z', description: 'Undo' },
      { keys: 'Ctrl/⌘ + Shift + Z', description: 'Redo' },
      { keys: 'Ctrl/⌘ + Y', description: 'Redo (alternative)' },
      { keys: 'Ctrl/⌘ + C', description: 'Copy selected elements' },
      { keys: 'Ctrl/⌘ + V', description: 'Paste elements' },
      { keys: 'Ctrl/⌘ + D', description: 'Duplicate selected elements' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: 'Ctrl/⌘ + +', description: 'Zoom in' },
      { keys: 'Ctrl/⌘ + -', description: 'Zoom out' },
      { keys: 'Ctrl/⌘ + 0', description: 'Reset zoom to 100%' },
      { keys: 'G', description: 'Toggle grid' },
      { keys: 'Shift + G', description: 'Toggle snap to grid' },
    ],
  },
  {
    title: 'Layer Order',
    shortcuts: [
      { keys: 'Ctrl/⌘ + ]', description: 'Bring forward' },
      { keys: 'Ctrl/⌘ + [', description: 'Send backward' },
      { keys: 'Ctrl/⌘ + Shift + ]', description: 'Bring to front' },
      { keys: 'Ctrl/⌘ + Shift + [', description: 'Send to back' },
    ],
  },
  {
    title: 'Layers',
    shortcuts: [
      { keys: 'H', description: 'Toggle visibility' },
      { keys: 'Ctrl/⌘ + L', description: 'Toggle lock' },
    ],
  },
  {
    title: 'Colors',
    shortcuts: [
      { keys: 'S', description: 'Open stroke color picker' },
      { keys: 'F', description: 'Open fill color picker' },
    ],
  },
  {
    title: 'Grouping',
    shortcuts: [
      { keys: 'Ctrl/⌘ + G', description: 'Group selected elements' },
      { keys: 'Ctrl/⌘ + Shift + G', description: 'Ungroup elements' },
      { keys: 'G (with grouped element)', description: 'Quick ungroup' },
    ],
  },
  {
    title: 'Text Formatting',
    shortcuts: [
      { keys: 'Ctrl/⌘ + B', description: 'Toggle bold' },
      { keys: 'Ctrl/⌘ + I', description: 'Toggle italic' },
      { keys: 'Ctrl/⌘ + Shift + L', description: 'Align left' },
      { keys: 'Ctrl/⌘ + Shift + E', description: 'Align center' },
      { keys: 'Ctrl/⌘ + Shift + R', description: 'Align right' },
    ],
  },
  {
    title: 'Text Presets',
    shortcuts: [
      { keys: 'Ctrl/⌘ + Alt + 1', description: 'Heading 1 (32px)' },
      { keys: 'Ctrl/⌘ + Alt + 2', description: 'Heading 2 (24px)' },
      { keys: 'Ctrl/⌘ + Alt + 3', description: 'Heading 3 (20px)' },
      { keys: 'Ctrl/⌘ + Alt + 0', description: 'Body text (16px)' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { keys: 'Ctrl/⌘ + \\', description: 'Toggle sidebars' },
      { keys: 'Ctrl/⌘ + Shift + C', description: 'Copy element style' },
      { keys: '?', description: 'Show keyboard shortcuts' },
      { keys: 'Shift (while drawing)', description: 'Constrain to 45° angles' },
      { keys: 'Space + drag', description: 'Pan canvas' },
      { keys: 'Middle-click drag', description: 'Pan canvas (alternative)' },
      { keys: 'Mouse wheel', description: 'Pan canvas' },
      { keys: 'Ctrl/⌘ + wheel', description: 'Zoom in/out' },
    ],
  },
];

export function KeyboardShortcutsPanel({ isOpen, onClose }: KeyboardShortcutsPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useFocusTrap(panelRef, isOpen);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Focus close button when panel opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 id="shortcuts-title" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Close shortcuts panel"
          >
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shortcutGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        {shortcut.description}
                      </span>
                      <kbd className="ml-2 px-2 py-0.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-zinc-200 dark:bg-zinc-700 rounded">?</kbd> to show this panel •
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-zinc-200 dark:bg-zinc-700 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

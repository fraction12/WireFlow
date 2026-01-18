'use client';

import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { DEFAULT_STROKE_COLOR, DEFAULT_FILL_COLOR } from '@/lib/colors';
import { RotateCcw } from 'lucide-react';

interface StylingToolbarProps {
  /** Current stroke color */
  strokeColor: string;
  /** Current fill color */
  fillColor: string;
  /** Callback when stroke color changes */
  onStrokeColorChange: (color: string) => void;
  /** Callback when fill color changes */
  onFillColorChange: (color: string) => void;
  /** Whether the toolbar is visible */
  isVisible: boolean;
}

export function StylingToolbar({
  strokeColor,
  fillColor,
  onStrokeColorChange,
  onFillColorChange,
  isVisible,
}: StylingToolbarProps) {
  const [strokePickerOpen, setStrokePickerOpen] = useState(false);
  const [fillPickerOpen, setFillPickerOpen] = useState(false);

  // Don't render if not visible
  if (!isVisible) return null;

  // Reset to default colors
  const handleResetColors = () => {
    onStrokeColorChange(DEFAULT_STROKE_COLOR);
    onFillColorChange(DEFAULT_FILL_COLOR);
    setStrokePickerOpen(false);
    setFillPickerOpen(false);
  };

  // Close other picker when opening one
  // NOTE: Keyboard shortcuts (S/G) are handled in Canvas.tsx
  // These handlers manage click-triggered picker state only
  const handleStrokePickerOpen = (open: boolean) => {
    setStrokePickerOpen(open);
    if (open) setFillPickerOpen(false);
  };

  const handleFillPickerOpen = (open: boolean) => {
    setFillPickerOpen(open);
    if (open) setStrokePickerOpen(false);
  };

  return (
    <div
      className="flex items-center gap-4 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm animate-fade-in"
      role="toolbar"
      aria-label="Element styling"
    >
      {/* Stroke color section */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-[32px]">
          Stroke
        </span>
        <ColorPicker
          selectedColor={strokeColor}
          onColorChange={onStrokeColorChange}
          label="Stroke"
          isOpen={strokePickerOpen}
          onOpenChange={handleStrokePickerOpen}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />

      {/* Fill color section */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-[32px]">
          Fill
        </span>
        <ColorPicker
          selectedColor={fillColor}
          onColorChange={onFillColorChange}
          label="Fill"
          isOpen={fillPickerOpen}
          onOpenChange={handleFillPickerOpen}
        />
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />

      {/* Reset button */}
      <button
        onClick={handleResetColors}
        className="w-7 h-7 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-95 cursor-pointer"
        title="Reset to defaults"
        aria-label="Reset colors to defaults"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

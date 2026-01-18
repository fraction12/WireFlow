'use client';

import { useEffect, useRef } from 'react';
import { STROKE_COLORS, FILL_COLORS, getContrastColor, type PresetColor } from '@/lib/colors';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  /** Currently selected color */
  selectedColor: string;
  /** Callback when color changes */
  onColorChange: (color: string) => void;
  /** Label for the picker (Stroke or Fill) */
  label: 'Stroke' | 'Fill';
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

export function ColorPicker({
  selectedColor,
  onColorChange,
  label,
  isOpen,
  onOpenChange,
}: ColorPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get appropriate color array based on label
  const colors = label === 'Stroke' ? STROKE_COLORS : FILL_COLORS;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  };

  // Handle color selection
  const handleColorSelect = (color: PresetColor) => {
    onColorChange(color.hex);
    onOpenChange(false);
  };

  // Render the color swatch trigger button
  const renderTrigger = () => {
    const isTransparent = selectedColor === 'transparent';

    return (
      <button
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`
          w-7 h-7 rounded-md border-2 flex items-center justify-center
          transition-all duration-150 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
          hover:scale-105 active:scale-95
          ${isOpen
            ? 'border-blue-500 shadow-md'
            : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
          }
        `}
        style={{
          backgroundColor: isTransparent ? 'transparent' : selectedColor,
        }}
        title={`${label}: ${selectedColor}`}
        aria-label={`${label} color: ${selectedColor}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Transparent indicator - diagonal line */}
        {isTransparent && (
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-red-500">
            <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </button>
    );
  };

  // Render the color palette dropdown
  const renderDropdown = () => {
    if (!isOpen) return null;

    return (
      <div
        ref={dropdownRef}
        className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 animate-scale-in"
        role="listbox"
        aria-label={`Select ${label.toLowerCase()} color`}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {colors.map((color) => {
            const isSelected = color.hex.toLowerCase() === selectedColor.toLowerCase();
            const isTransparent = color.hex === 'transparent';

            return (
              <button
                key={color.hex}
                onClick={() => handleColorSelect(color)}
                className={`
                  w-7 h-7 rounded-md border-2 flex items-center justify-center
                  transition-all duration-150 ease-out
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                  hover:scale-110 active:scale-95
                  ${isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-400'
                  }
                `}
                style={{
                  backgroundColor: isTransparent ? 'transparent' : color.hex,
                }}
                title={color.name}
                aria-label={color.name}
                role="option"
                aria-selected={isSelected}
              >
                {/* Transparent indicator */}
                {isTransparent && (
                  <svg width="20" height="20" viewBox="0 0 20 20" className="text-red-500">
                    <line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
                {/* Selected checkmark for non-transparent colors */}
                {isSelected && !isTransparent && (
                  <Check size={16} color={getContrastColor(color.hex)} strokeWidth={3} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {renderTrigger()}
      {renderDropdown()}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

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

  // Focus management: set initial focused index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      // Find index of currently selected color
      const selectedIndex = colors.findIndex(
        c => c.hex.toLowerCase() === selectedColor.toLowerCase()
      );
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, selectedColor, colors]);

  // Handle keyboard navigation in dropdown
  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % colors.length);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + colors.length) % colors.length);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          handleColorSelect(colors[focusedIndex]);
        }
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(colors.length - 1);
        break;
    }
  };

  // Handle color selection
  const handleColorSelect = (color: PresetColor) => {
    onColorChange(color.hex);
    onOpenChange(false);
    // Return focus to trigger after selection
    triggerRef.current?.focus();
  };

  // Render the color swatch trigger button
  const renderTrigger = () => {
    const isTransparent = selectedColor === 'transparent';

    return (
      <button
        ref={triggerRef}
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={handleDropdownKeyDown}
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

    // Generate unique ID for aria-activedescendant
    const getOptionId = (index: number) => `color-option-${label}-${index}`;

    return (
      <div
        className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 animate-scale-in"
        role="listbox"
        aria-label={`Select ${label.toLowerCase()} color`}
        aria-activedescendant={focusedIndex >= 0 ? getOptionId(focusedIndex) : undefined}
        onKeyDown={handleDropdownKeyDown}
        tabIndex={-1}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((color, index) => {
            const isSelected = color.hex.toLowerCase() === selectedColor.toLowerCase();
            const isFocused = index === focusedIndex;
            const isTransparent = color.hex === 'transparent';

            return (
              <button
                id={getOptionId(index)}
                key={color.hex}
                onClick={() => handleColorSelect(color)}
                className={`
                  w-7 h-7 rounded-md border-2 flex items-center justify-center
                  transition-all duration-150 ease-out
                  focus:outline-none
                  hover:scale-110 active:scale-95
                  ${isSelected
                    ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]'
                    : isFocused
                    ? 'border-blue-400 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]'
                    : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-500'
                  }
                `}
                style={{
                  backgroundColor: isTransparent ? 'transparent' : color.hex,
                }}
                title={color.name}
                aria-label={color.name}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
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

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { STROKE_COLORS, FILL_COLORS, getContrastColor, type PresetColor } from '@/lib/colors';
import { Check } from 'lucide-react';
import { Divider } from '@/components/ui/Divider';
import { useRovingTabindex } from '@/lib/useRovingTabindex';

/** Color name tooltip that appears on hover/focus for accessibility */
function ColorNameTooltip({ name, visible }: { name: string; visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      role="tooltip"
      className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium
        bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900
        rounded shadow-lg whitespace-nowrap z-10 pointer-events-none
        animate-fade-in"
    >
      {name}
      {/* Tooltip arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
        border-l-4 border-r-4 border-t-4
        border-l-transparent border-r-transparent
        border-t-zinc-900 dark:border-t-zinc-100" />
    </div>
  );
}

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
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [hexInputValue, setHexInputValue] = useState(selectedColor);
  const [hexInputError, setHexInputError] = useState(false);
  // Track hovered color index for tooltip display
  const [hoveredColorIndex, setHoveredColorIndex] = useState<number | null>(null);

  // Get appropriate color array based on label
  const colors = label === 'Stroke' ? STROKE_COLORS : FILL_COLORS;

  // Find initial index based on selected color
  const selectedIndex = colors.findIndex(
    c => c.hex.toLowerCase() === selectedColor.toLowerCase()
  );

  // Handle closing dropdown and returning focus
  const handleClose = useCallback(() => {
    onOpenChange(false);
    setShowCustomPicker(false);
    triggerRef.current?.focus();
  }, [onOpenChange]);

  // Handle color selection
  const handleColorSelect = useCallback((color: PresetColor) => {
    onColorChange(color.hex);
    handleClose();
  }, [onColorChange, handleClose]);

  // Use roving tabindex hook for keyboard navigation
  const {
    focusedIndex,
    getItemRef,
    handleKeyDown: rovingKeyDown,
    getTabIndex,
  } = useRovingTabindex<HTMLButtonElement>({
    itemCount: colors.length,
    isActive: isOpen && !showCustomPicker,
    initialIndex: selectedIndex >= 0 ? selectedIndex : 0,
    onSelect: (index) => handleColorSelect(colors[index]),
    onEscape: handleClose,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
        setShowCustomPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onOpenChange]);

  // Reset showCustomPicker when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setShowCustomPicker(false);
    }
  }, [isOpen]);

  // Sync hex input with selected color when it changes externally
  useEffect(() => {
    setHexInputValue(selectedColor === 'transparent' ? '' : selectedColor);
    setHexInputError(false);
  }, [selectedColor]);

  // Handle keyboard navigation in dropdown (delegates to roving tabindex)
  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    // When custom picker is shown, only handle Escape
    if (showCustomPicker) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
      return;
    }

    rovingKeyDown(e);
  };

  // Handle custom color change from spectrum picker
  const handleCustomColorChange = (color: string) => {
    onColorChange(color);
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
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-red-500" aria-hidden="true">
            <line x1="4" y1="20" x2="20" y2="4" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </button>
    );
  };

  // Render the color palette dropdown
  const renderDropdown = () => {
    if (!isOpen) return null;

    const getOptionId = (index: number) => `color-option-${label}-${index}`;

    return (
      <div
        className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 animate-scale-in min-w-[200px]"
        role="listbox"
        aria-label={`Select ${label.toLowerCase()} color`}
        aria-activedescendant={focusedIndex >= 0 ? getOptionId(focusedIndex) : undefined}
      >
        {/* Preset Color Grid */}
        <div className="grid grid-cols-5 gap-2" role="presentation">
          {colors.map((color, index) => {
            const isSelected = color.hex.toLowerCase() === selectedColor.toLowerCase();
            const isFocused = index === focusedIndex;
            const isTransparent = color.hex === 'transparent';

            const showTooltip = hoveredColorIndex === index || isFocused;

            return (
              <div key={color.hex} className="relative">
                <ColorNameTooltip name={color.name} visible={showTooltip} />
                <button
                  id={getOptionId(index)}
                  ref={getItemRef(index)}
                  onClick={() => handleColorSelect(color)}
                  onKeyDown={handleDropdownKeyDown}
                  onMouseEnter={() => setHoveredColorIndex(index)}
                  onMouseLeave={() => setHoveredColorIndex(null)}
                  onFocus={() => setHoveredColorIndex(index)}
                  onBlur={() => setHoveredColorIndex(null)}
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    transition-all duration-150 ease-out
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                    hover:scale-105 active:scale-95
                    ${isSelected
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : isFocused
                      ? 'ring-2 ring-blue-300 ring-offset-1'
                      : 'ring-1 ring-zinc-200 dark:ring-zinc-600 hover:ring-zinc-400'
                    }
                  `}
                  style={{
                    backgroundColor: isTransparent ? '#ffffff' : color.hex,
                  }}
                  aria-label={`${color.name}${isSelected ? ' (selected)' : ''}`}
                  aria-describedby={`color-tooltip-${label}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={getTabIndex(index)}
                >
                  {/* Transparent indicator */}
                  {isTransparent && (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      className="text-red-500"
                      aria-hidden="true"
                    >
                      <line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                  {/* Selected checkmark for non-transparent colors */}
                  {isSelected && !isTransparent && (
                    <Check size={16} color={getContrastColor(color.hex)} strokeWidth={3} />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <Divider className="my-2" />

        {/* Custom Color Toggle */}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              handleClose();
            }
          }}
          className="w-full text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          aria-expanded={showCustomPicker}
        >
          {showCustomPicker ? 'Hide custom color' : 'Custom color...'}
        </button>

        {/* Custom Color Picker (react-colorful) */}
        {showCustomPicker && (
          <div className="mt-2">
            <HexColorPicker
              color={selectedColor === 'transparent' ? '#ffffff' : selectedColor}
              onChange={handleCustomColorChange}
              style={{ width: '100%', height: '150px' }}
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={hexInputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow typing any hex-like value (# followed by hex chars)
                  if (/^#?[0-9A-Fa-f]{0,6}$/.test(val) || val === '') {
                    // Auto-prepend # if user starts typing without it
                    const normalized = val && !val.startsWith('#') ? `#${val}` : val;
                    setHexInputValue(normalized || '#');
                    // Clear error while typing
                    setHexInputError(false);
                  }
                }}
                onBlur={() => {
                  // Validate on blur - must be complete 6-character hex
                  if (/^#[0-9A-Fa-f]{6}$/.test(hexInputValue)) {
                    onColorChange(hexInputValue);
                    setHexInputError(false);
                  } else if (hexInputValue === '' || hexInputValue === '#') {
                    // Reset to current color if empty
                    setHexInputValue(selectedColor === 'transparent' ? '' : selectedColor);
                    setHexInputError(false);
                  } else {
                    // Show error for invalid/incomplete hex
                    setHexInputError(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClose();
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    // Apply on Enter if valid
                    if (/^#[0-9A-Fa-f]{6}$/.test(hexInputValue)) {
                      onColorChange(hexInputValue);
                      setHexInputError(false);
                    } else {
                      setHexInputError(true);
                    }
                  }
                }}
                placeholder="#000000"
                aria-label="Custom hex color value"
                aria-invalid={hexInputError}
                className={`flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 ${
                  hexInputError
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500'
                }`}
              />
            </div>
            {hexInputError && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                Enter a valid 6-digit hex color (e.g., #FF5733)
              </p>
            )}
          </div>
        )}
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

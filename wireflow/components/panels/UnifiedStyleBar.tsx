'use client';

import { useState, useRef, useEffect } from 'react';
import { ColorPicker } from './ColorPicker';
import { Divider } from '@/components/ui/Divider';
import { DEFAULT_STROKE_COLOR, DEFAULT_FILL_COLOR } from '@/lib/colors';
import { TEXT_PRESETS, FONT_SIZES } from '@/lib/textPresets';
import type { TextElement, TextAlign, FontWeight, FontStyle, TextPreset } from '@/lib/types';
import {
  RotateCcw,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from 'lucide-react';

/** Indicator for mixed values in multi-selection */
const MIXED_VALUE = 'mixed';

interface UnifiedStyleBarProps {
  // Color controls (always enabled)
  strokeColor: string | typeof MIXED_VALUE;
  fillColor: string | typeof MIXED_VALUE;
  onStrokeColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;

  // Multi-selection info
  selectionCount: number; // 0 = no selection, 1 = single, >1 = multi

  // Text controls (enabled only when selectedTextElement is not null)
  selectedTextElement: TextElement | null;
  onTextUpdate: (updates: Partial<TextElement>) => void;

  // Controlled picker state for keyboard shortcuts
  strokePickerOpen: boolean;
  fillPickerOpen: boolean;
  onStrokePickerOpenChange: (open: boolean) => void;
  onFillPickerOpenChange: (open: boolean) => void;

  // Optional: disabled state for locked elements
  disabled?: boolean;
}

export function UnifiedStyleBar({
  strokeColor,
  fillColor,
  onStrokeColorChange,
  onFillColorChange,
  selectionCount,
  selectedTextElement,
  onTextUpdate,
  strokePickerOpen,
  fillPickerOpen,
  onStrokePickerOpenChange,
  onFillPickerOpenChange,
  disabled = false,
}: UnifiedStyleBarProps) {
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [focusedSizeIndex, setFocusedSizeIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const resetButtonRef = useRef<HTMLButtonElement>(null);

  // Check for mixed values in multi-selection
  const isStrokeMixed = strokeColor === MIXED_VALUE;
  const isFillMixed = fillColor === MIXED_VALUE;

  // Get effective colors for display (use default for mixed)
  const displayStrokeColor = isStrokeMixed ? DEFAULT_STROKE_COLOR : strokeColor;
  const displayFillColor = isFillMixed ? DEFAULT_FILL_COLOR : fillColor;

  // Get current text values with defaults
  const fontSize = selectedTextElement?.fontSize || 16;
  const fontWeight = selectedTextElement?.fontWeight || 'normal';
  const fontStyle = selectedTextElement?.fontStyle || 'normal';
  const textAlign = selectedTextElement?.textAlign || 'left';
  const preset = selectedTextElement?.preset;

  const textControlsDisabled = !selectedTextElement || disabled;
  const colorControlsDisabled = disabled;

  // Close other picker when opening one
  const handleStrokePickerOpen = (open: boolean) => {
    onStrokePickerOpenChange(open);
    if (open) onFillPickerOpenChange(false);
  };

  const handleFillPickerOpen = (open: boolean) => {
    onFillPickerOpenChange(open);
    if (open) onStrokePickerOpenChange(false);
  };

  // Reset colors to defaults with focus management
  const handleResetColors = () => {
    onStrokeColorChange(DEFAULT_STROKE_COLOR);
    onFillColorChange(DEFAULT_FILL_COLOR);
    onStrokePickerOpenChange(false);
    onFillPickerOpenChange(false);
    // Maintain focus on reset button
    resetButtonRef.current?.focus();
  };

  // Close font size dropdown when clicking outside
  useEffect(() => {
    if (!showSizeDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSizeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSizeDropdown]);

  // Text control handlers
  const handlePresetClick = (presetKey: TextPreset) => {
    if (textControlsDisabled) return;
    const config = TEXT_PRESETS[presetKey];
    onTextUpdate({
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      lineHeight: Math.round(config.fontSize * config.lineHeight),
      preset: presetKey,
    });
  };

  const handleFontSizeChange = (size: number) => {
    if (textControlsDisabled) return;
    onTextUpdate({
      fontSize: size,
      lineHeight: Math.round(size * 1.5),
      preset: undefined, // Clear preset when manually changing size
    });
    setShowSizeDropdown(false);
    setFocusedSizeIndex(-1);
  };

  const toggleBold = () => {
    if (textControlsDisabled) return;
    const newWeight: FontWeight = fontWeight === 'bold' ? 'normal' : 'bold';
    onTextUpdate({ fontWeight: newWeight, preset: undefined });
  };

  const toggleItalic = () => {
    if (textControlsDisabled) return;
    const newStyle: FontStyle = fontStyle === 'italic' ? 'normal' : 'italic';
    onTextUpdate({ fontStyle: newStyle });
  };

  const handleAlignChange = (align: TextAlign) => {
    if (textControlsDisabled) return;
    onTextUpdate({ textAlign: align });
  };

  // Keyboard navigation for font size dropdown
  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!showSizeDropdown) return;

    switch (e.key) {
      case 'Escape':
        setShowSizeDropdown(false);
        setFocusedSizeIndex(-1);
        e.preventDefault();
        break;
      case 'ArrowDown':
        setFocusedSizeIndex((prev) => Math.min(prev + 1, FONT_SIZES.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setFocusedSizeIndex((prev) => Math.max(prev - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (focusedSizeIndex >= 0) {
          handleFontSizeChange(FONT_SIZES[focusedSizeIndex]);
        }
        e.preventDefault();
        break;
      case 'Home':
        setFocusedSizeIndex(0);
        e.preventDefault();
        break;
      case 'End':
        setFocusedSizeIndex(FONT_SIZES.length - 1);
        e.preventDefault();
        break;
    }
  };

  const presets: { key: TextPreset; label: string }[] = [
    { key: 'heading1', label: 'H1' },
    { key: 'heading2', label: 'H2' },
    { key: 'heading3', label: 'H3' },
    { key: 'body', label: 'Body' },
    { key: 'label', label: 'Label' },
    { key: 'caption', label: 'Cap' },
  ];

  // Shared button styles - standardized to 32px height
  const buttonBase = `
    h-8 px-2 flex items-center justify-center rounded
    transition-all duration-150 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
    active:scale-95
  `;

  const buttonInactive = `
    text-zinc-600 dark:text-zinc-400
    hover:bg-zinc-100 dark:hover:bg-zinc-700
    hover:text-zinc-900 dark:hover:text-zinc-100
  `;

  const buttonActive = `
    bg-blue-100 text-blue-700
    dark:bg-blue-900/80 dark:text-blue-200
    shadow-sm
    font-medium
  `;

  const buttonDisabled = `
    opacity-50 pointer-events-none cursor-not-allowed
  `;

  // Generate selection label for accessibility
  const selectionLabel = selectionCount === 0
    ? 'No selection'
    : selectionCount === 1
    ? '1 element selected'
    : `${selectionCount} elements selected`;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm animate-fade-in"
      role="toolbar"
      aria-label={`Element styling and text formatting. ${selectionLabel}`}
    >
      {/* Selection count indicator (visible only for multi-selection) */}
      {selectionCount > 1 && (
        <>
          <span
            className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded"
            aria-live="polite"
          >
            {selectionCount} selected
          </span>
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
        </>
      )}

      {/* ============================================ */}
      {/* COLOR CONTROLS (Always Enabled unless disabled) */}
      {/* ============================================ */}
      <div
        className={`flex items-center gap-2 ${colorControlsDisabled ? 'opacity-50 pointer-events-none' : ''}`}
        role="group"
        aria-label="Color controls"
        aria-disabled={colorControlsDisabled}
      >
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-[32px]">
            Stroke
          </span>
          {isStrokeMixed && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400" title="Mixed values in selection">
              (mixed)
            </span>
          )}
        </div>
        <ColorPicker
          selectedColor={displayStrokeColor}
          onColorChange={onStrokeColorChange}
          label="Stroke"
          isOpen={strokePickerOpen}
          onOpenChange={handleStrokePickerOpen}
        />
      </div>

      <div className={`flex items-center gap-2 ${colorControlsDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-[32px]">
            Fill
          </span>
          {isFillMixed && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400" title="Mixed values in selection">
              (mixed)
            </span>
          )}
        </div>
        <ColorPicker
          selectedColor={displayFillColor}
          onColorChange={onFillColorChange}
          label="Fill"
          isOpen={fillPickerOpen}
          onOpenChange={handleFillPickerOpen}
        />
      </div>

      {/* Divider */}
      <Divider orientation="vertical" />

      {/* ============================================ */}
      {/* TEXT PRESETS (Disabled when no text selected) */}
      {/* ============================================ */}
      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="Text presets"
        aria-disabled={textControlsDisabled}
      >
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePresetClick(key)}
            disabled={textControlsDisabled}
            className={`${buttonBase} min-w-[36px] text-xs ${
              preset === key ? buttonActive : buttonInactive
            } ${textControlsDisabled ? buttonDisabled : ''}`}
            title={textControlsDisabled ? 'Select text to enable' : TEXT_PRESETS[key].label}
            aria-label={`Apply ${TEXT_PRESETS[key].label} style`}
            aria-pressed={!textControlsDisabled && preset === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <Divider orientation="vertical" />

      {/* ============================================ */}
      {/* BOLD & ITALIC (Disabled when no text selected) */}
      {/* ============================================ */}
      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="Text formatting"
        aria-disabled={textControlsDisabled}
      >
        <button
          onClick={toggleBold}
          disabled={textControlsDisabled}
          className={`${buttonBase} w-7 ${fontWeight === 'bold' ? buttonActive : buttonInactive} ${
            textControlsDisabled ? buttonDisabled : ''
          }`}
          title={textControlsDisabled ? 'Select text to enable' : 'Bold'}
          aria-label="Toggle bold"
          aria-pressed={!textControlsDisabled && fontWeight === 'bold'}
        >
          <Bold size={16} strokeWidth={fontWeight === 'bold' ? 2.5 : 2} />
        </button>
        <button
          onClick={toggleItalic}
          disabled={textControlsDisabled}
          className={`${buttonBase} w-7 ${fontStyle === 'italic' ? buttonActive : buttonInactive} ${
            textControlsDisabled ? buttonDisabled : ''
          }`}
          title={textControlsDisabled ? 'Select text to enable' : 'Italic'}
          aria-label="Toggle italic"
          aria-pressed={!textControlsDisabled && fontStyle === 'italic'}
        >
          <Italic size={16} strokeWidth={fontStyle === 'italic' ? 2.5 : 2} />
        </button>
      </div>

      {/* Divider */}
      <Divider orientation="vertical" />

      {/* ============================================ */}
      {/* TEXT ALIGNMENT (Disabled when no text selected) */}
      {/* ============================================ */}
      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="Text alignment"
        aria-disabled={textControlsDisabled}
      >
        <button
          onClick={() => handleAlignChange('left')}
          disabled={textControlsDisabled}
          className={`${buttonBase} w-7 ${textAlign === 'left' ? buttonActive : buttonInactive} ${
            textControlsDisabled ? buttonDisabled : ''
          }`}
          title={textControlsDisabled ? 'Select text to enable' : 'Align left'}
          aria-label="Align left"
          aria-pressed={!textControlsDisabled && textAlign === 'left'}
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => handleAlignChange('center')}
          disabled={textControlsDisabled}
          className={`${buttonBase} w-7 ${textAlign === 'center' ? buttonActive : buttonInactive} ${
            textControlsDisabled ? buttonDisabled : ''
          }`}
          title={textControlsDisabled ? 'Select text to enable' : 'Align center'}
          aria-label="Align center"
          aria-pressed={!textControlsDisabled && textAlign === 'center'}
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => handleAlignChange('right')}
          disabled={textControlsDisabled}
          className={`${buttonBase} w-7 ${textAlign === 'right' ? buttonActive : buttonInactive} ${
            textControlsDisabled ? buttonDisabled : ''
          }`}
          title={textControlsDisabled ? 'Select text to enable' : 'Align right'}
          aria-label="Align right"
          aria-pressed={!textControlsDisabled && textAlign === 'right'}
        >
          <AlignRight size={16} />
        </button>
      </div>

      {/* Divider */}
      <Divider orientation="vertical" />

      {/* ============================================ */}
      {/* FONT SIZE DROPDOWN (Disabled when no text selected) */}
      {/* ============================================ */}
      <div
        className="relative"
        ref={dropdownRef}
        role="group"
        aria-label="Font size"
        aria-disabled={textControlsDisabled}
      >
        <button
          onClick={() => {
            if (textControlsDisabled) return;
            const newState = !showSizeDropdown;
            setShowSizeDropdown(newState);
            if (newState) {
              // Initialize focused index to current size when opening
              const currentIndex = FONT_SIZES.indexOf(fontSize);
              setFocusedSizeIndex(currentIndex >= 0 ? currentIndex : 0);
            } else {
              setFocusedSizeIndex(-1);
            }
          }}
          onKeyDown={handleDropdownKeyDown}
          disabled={textControlsDisabled}
          className={`${buttonBase} ${buttonInactive} min-w-[60px] gap-1 text-sm ${
            textControlsDisabled ? buttonDisabled : ''
          }`}
          title={textControlsDisabled ? 'Select text to enable' : 'Font size'}
          aria-label={textControlsDisabled ? 'Font size' : `Font size: ${fontSize}px`}
          aria-expanded={!textControlsDisabled && showSizeDropdown}
          aria-haspopup="listbox"
        >
          <span>{fontSize}</span>
          <ChevronDown size={14} />
        </button>
        {showSizeDropdown && !textControlsDisabled && (
          <div
            className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[60px] max-h-48 overflow-y-auto z-50"
            role="listbox"
            aria-label="Select font size"
            onKeyDown={handleDropdownKeyDown}
          >
            {FONT_SIZES.map((size, index) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`
                  w-full px-3 py-1.5 text-sm text-left transition-colors
                  ${
                    size === fontSize
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : index === focusedSizeIndex
                      ? 'bg-zinc-200 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }
                `}
                role="option"
                aria-selected={size === fontSize}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <Divider orientation="vertical" />

      {/* ============================================ */}
      {/* RESET BUTTON (Always Enabled) */}
      {/* ============================================ */}
      <button
        ref={resetButtonRef}
        onClick={handleResetColors}
        className="w-8 h-8 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-95 cursor-pointer"
        title="Reset colors to defaults"
        aria-label="Reset colors to defaults"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}

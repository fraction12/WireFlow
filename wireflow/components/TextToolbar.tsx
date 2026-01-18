'use client';

import type { TextElement, TextAlign, FontWeight, FontStyle, TextPreset } from '@/lib/types';
import { TEXT_PRESETS, FONT_SIZES } from '@/lib/textPresets';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface TextToolbarProps {
  element: TextElement;
  canvasRect: DOMRect | null;
  onUpdate: (updates: Partial<TextElement>) => void;
}

export function TextToolbar({ element, canvasRect, onUpdate }: TextToolbarProps) {
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current values with defaults
  const fontSize = element.fontSize || 16;
  const fontWeight = element.fontWeight || 'normal';
  const fontStyle = element.fontStyle || 'normal';
  const textAlign = element.textAlign || 'left';
  const preset = element.preset;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSizeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate toolbar position
  const getToolbarStyle = (): React.CSSProperties => {
    if (!canvasRect) return { display: 'none' };

    const toolbarHeight = 40;
    const gap = 8;

    // Position above the element by default
    let top = element.y - toolbarHeight - gap;
    let left = element.x;

    // If too close to top, position below
    if (top < 0) {
      top = element.y + element.height + gap;
    }

    // Clamp horizontal position to stay within canvas
    const toolbarWidth = 400; // Approximate width
    if (left + toolbarWidth > canvasRect.width) {
      left = canvasRect.width - toolbarWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    return {
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 50,
    };
  };

  const handlePresetClick = (presetKey: TextPreset) => {
    const config = TEXT_PRESETS[presetKey];
    onUpdate({
      fontSize: config.fontSize,
      fontWeight: config.fontWeight,
      lineHeight: Math.round(config.fontSize * config.lineHeight),
      preset: presetKey,
    });
  };

  const handleFontSizeChange = (size: number) => {
    onUpdate({
      fontSize: size,
      lineHeight: Math.round(size * 1.5),
      preset: undefined, // Clear preset when manually changing size
    });
    setShowSizeDropdown(false);
  };

  const toggleBold = () => {
    const newWeight: FontWeight = fontWeight === 'bold' ? 'normal' : 'bold';
    onUpdate({ fontWeight: newWeight, preset: undefined });
  };

  const toggleItalic = () => {
    const newStyle: FontStyle = fontStyle === 'italic' ? 'normal' : 'italic';
    onUpdate({ fontStyle: newStyle });
  };

  const handleAlignChange = (align: TextAlign) => {
    onUpdate({ textAlign: align });
  };

  const presets: { key: TextPreset; label: string }[] = [
    { key: 'heading1', label: 'H1' },
    { key: 'heading2', label: 'H2' },
    { key: 'heading3', label: 'H3' },
    { key: 'body', label: 'Body' },
    { key: 'label', label: 'Label' },
  ];

  const buttonBase = `
    h-8 px-2 flex items-center justify-center rounded
    transition-all duration-150 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
    active:scale-95
  `;

  const buttonInactive = `
    text-zinc-600 dark:text-zinc-400
    hover:bg-zinc-100 dark:hover:bg-zinc-700
    hover:text-zinc-900 dark:hover:text-zinc-100
  `;

  const buttonActive = `
    bg-blue-100 text-blue-700
    dark:bg-blue-900 dark:text-blue-300
  `;

  return (
    <div
      ref={toolbarRef}
      style={getToolbarStyle()}
      className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-2 py-1"
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Preset buttons */}
      <div className="flex items-center gap-0.5 border-r border-zinc-200 dark:border-zinc-700 pr-2 mr-1">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePresetClick(key)}
            className={`${buttonBase} min-w-[32px] text-xs font-medium ${
              preset === key ? buttonActive : buttonInactive
            }`}
            title={TEXT_PRESETS[key].label}
            aria-label={`Apply ${TEXT_PRESETS[key].label} style`}
            aria-pressed={preset === key}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bold/Italic buttons */}
      <div className="flex items-center gap-0.5 border-r border-zinc-200 dark:border-zinc-700 pr-2 mr-1">
        <button
          onClick={toggleBold}
          className={`${buttonBase} w-8 ${fontWeight === 'bold' ? buttonActive : buttonInactive}`}
          title="Bold (Ctrl+B)"
          aria-label="Toggle bold"
          aria-pressed={fontWeight === 'bold'}
        >
          <Bold size={16} strokeWidth={fontWeight === 'bold' ? 2.5 : 2} />
        </button>
        <button
          onClick={toggleItalic}
          className={`${buttonBase} w-8 ${fontStyle === 'italic' ? buttonActive : buttonInactive}`}
          title="Italic (Ctrl+I)"
          aria-label="Toggle italic"
          aria-pressed={fontStyle === 'italic'}
        >
          <Italic size={16} strokeWidth={fontStyle === 'italic' ? 2.5 : 2} />
        </button>
      </div>

      {/* Alignment buttons */}
      <div className="flex items-center gap-0.5 border-r border-zinc-200 dark:border-zinc-700 pr-2 mr-1">
        <button
          onClick={() => handleAlignChange('left')}
          className={`${buttonBase} w-8 ${textAlign === 'left' ? buttonActive : buttonInactive}`}
          title="Align left (Ctrl+Shift+L)"
          aria-label="Align left"
          aria-pressed={textAlign === 'left'}
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => handleAlignChange('center')}
          className={`${buttonBase} w-8 ${textAlign === 'center' ? buttonActive : buttonInactive}`}
          title="Align center (Ctrl+Shift+E)"
          aria-label="Align center"
          aria-pressed={textAlign === 'center'}
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => handleAlignChange('right')}
          className={`${buttonBase} w-8 ${textAlign === 'right' ? buttonActive : buttonInactive}`}
          title="Align right (Ctrl+Shift+R)"
          aria-label="Align right"
          aria-pressed={textAlign === 'right'}
        >
          <AlignRight size={16} />
        </button>
      </div>

      {/* Font size dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowSizeDropdown(!showSizeDropdown)}
          className={`${buttonBase} ${buttonInactive} min-w-[60px] gap-1 text-sm`}
          title="Font size"
          aria-label={`Font size: ${fontSize}px`}
          aria-expanded={showSizeDropdown}
          aria-haspopup="listbox"
        >
          <span>{fontSize}</span>
          <ChevronDown size={14} />
        </button>
        {showSizeDropdown && (
          <div
            className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[60px] max-h-48 overflow-y-auto"
            role="listbox"
            aria-label="Select font size"
          >
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => handleFontSizeChange(size)}
                className={`
                  w-full px-3 py-1.5 text-sm text-left
                  ${size === fontSize
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
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
    </div>
  );
}

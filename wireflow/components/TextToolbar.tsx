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
import { useState, useRef, useEffect, useMemo } from 'react';

interface TextToolbarProps {
  element: TextElement;
  canvasRect: DOMRect | null;
  onUpdate: (updates: Partial<TextElement>) => void;
  zoom: number;
  pan: { x: number; y: number };
}

type ToolbarPosition = 'above' | 'below' | 'side';

export function TextToolbar({ element, canvasRect, onUpdate, zoom, pan }: TextToolbarProps) {
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

  // Calculate toolbar position with improved logic using useMemo to avoid re-render loops
  const { toolbarStyle, position } = useMemo(() => {
    if (!canvasRect) {
      return {
        toolbarStyle: { display: 'none' } as React.CSSProperties,
        position: 'above' as ToolbarPosition,
      };
    }

    const toolbarHeight = 44; // Slightly increased for better visual comfort
    const toolbarWidth = 420; // Approximate width
    const gap = 12; // Increased gap from element
    const padding = 16; // Padding from canvas edges

    // Transform element coordinates to screen space
    const screenX = element.x * zoom + pan.x;
    const screenY = element.y * zoom + pan.y;
    const screenWidth = element.width * zoom;
    const screenHeight = element.height * zoom;

    let top = 0;
    let left = 0;
    let calculatedPosition: ToolbarPosition = 'above';
    let pointerOffset = '50%'; // Centered by default

    // Calculate horizontal position - center on the text cursor/click position
    // For text elements, we center on element.x (where the user clicked to create text)
    // This keeps the toolbar stable as the user types and the element width expands
    const centerX = screenX;
    left = centerX - toolbarWidth / 2;

    // Clamp to stay within canvas bounds
    if (left < padding) {
      left = padding;
      // Calculate pointer offset when toolbar is clamped to left
      const offset = centerX - left;
      pointerOffset = `${Math.max(20, Math.min(offset, toolbarWidth - 20))}px`;
    } else if (left + toolbarWidth > canvasRect.width - padding) {
      left = canvasRect.width - toolbarWidth - padding;
      // Calculate pointer offset when toolbar is clamped to right
      const offset = centerX - left;
      pointerOffset = `${Math.max(20, Math.min(offset, toolbarWidth - 20))}px`;
    }

    // Try positioning above first
    const aboveY = screenY - toolbarHeight - gap;
    if (aboveY >= padding) {
      top = aboveY;
      calculatedPosition = 'above';
    } else {
      // If not enough space above, try below
      const belowY = screenY + screenHeight + gap;
      if (belowY + toolbarHeight <= canvasRect.height - padding) {
        top = belowY;
        calculatedPosition = 'below';
      } else {
        // If no space above or below, position to the side
        top = screenY;
        left = screenX + screenWidth + gap;
        calculatedPosition = 'side';
        pointerOffset = '20px'; // Top aligned for side position

        // If no space on right, try left
        if (left + toolbarWidth > canvasRect.width - padding) {
          left = screenX - toolbarWidth - gap;
          if (left < padding) {
            // Last resort: position above or below, overlapping if necessary
            top = aboveY >= 0 ? aboveY : screenY + screenHeight + gap;
            left = Math.max(padding, Math.min(centerX - toolbarWidth / 2, canvasRect.width - toolbarWidth - padding));
            calculatedPosition = aboveY >= 0 ? 'above' : 'below';
          }
        }
      }
    }

    return {
      toolbarStyle: {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 50,
        '--pointer-offset': pointerOffset,
      } as React.CSSProperties & { '--pointer-offset': string },
      position: calculatedPosition,
    };
  }, [canvasRect, element.x, element.y, element.width, element.height, zoom, pan.x, pan.y]);

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
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
    active:scale-95
  `;

  const buttonInactive = `
    text-zinc-600 dark:text-zinc-400
    hover:bg-zinc-100 dark:hover:bg-zinc-700
    hover:text-zinc-900 dark:hover:text-zinc-100
    hover:shadow-sm
  `;

  const buttonActive = `
    bg-blue-100 text-blue-700
    dark:bg-blue-900/80 dark:text-blue-200
    shadow-sm
    font-medium
  `;

  // Determine animation class based on position
  const getAnimationClass = () => {
    switch (position) {
      case 'above':
        return 'animate-slide-in-down';
      case 'below':
        return 'animate-slide-in-up';
      case 'side':
        return 'animate-scale-in';
      default:
        return 'animate-fade-in';
    }
  };

  return (
    <div
      ref={toolbarRef}
      style={toolbarStyle}
      className={`
        text-toolbar
        flex items-center gap-1
        bg-white dark:bg-zinc-800
        border border-zinc-200 dark:border-zinc-700
        rounded-lg px-2.5 py-1.5
        ${getAnimationClass()}
        toolbar-position-${position}
      `}
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent textarea from losing focus
        e.stopPropagation();
      }}
    >
      {/* Preset buttons */}
      <div className="flex items-center gap-0.5 border-r border-zinc-300/60 dark:border-zinc-600/60 pr-2 mr-1">
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
      <div className="flex items-center gap-0.5 border-r border-zinc-300/60 dark:border-zinc-600/60 pr-2 mr-1">
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
      <div className="flex items-center gap-0.5 border-r border-zinc-300/60 dark:border-zinc-600/60 pr-2 mr-1">
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

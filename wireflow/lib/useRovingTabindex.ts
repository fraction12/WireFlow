'use client';

import { useEffect, useRef, useState, useCallback, RefObject } from 'react';

export interface UseRovingTabindexOptions {
  /** Total number of items in the collection */
  itemCount: number;
  /** Whether the roving tabindex is active (e.g., dropdown is open) */
  isActive: boolean;
  /** Initial focused index when activated (-1 for none) */
  initialIndex?: number;
  /** Whether to wrap around at boundaries (default: true) */
  wrap?: boolean;
  /** Callback when an item is selected via Enter/Space */
  onSelect?: (index: number) => void;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Whether arrow navigation is disabled (e.g., when in sub-component) */
  disabled?: boolean;
}

export interface UseRovingTabindexReturn<T extends HTMLElement> {
  /** Current focused index (-1 if none) */
  focusedIndex: number;
  /** Set the focused index manually */
  setFocusedIndex: (index: number) => void;
  /** Ref callback for collecting item refs - use as ref={getItemRef(index)} */
  getItemRef: (index: number) => (el: T | null) => void;
  /** Keyboard event handler to attach to items or container */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Get tabIndex for an item based on its index */
  getTabIndex: (index: number) => 0 | -1;
}

/**
 * A hook implementing the roving tabindex pattern for accessible keyboard navigation.
 *
 * In roving tabindex, only one item in a collection has tabindex="0" (is tabbable),
 * while all others have tabindex="-1". Arrow keys move focus between items.
 *
 * @example
 * ```tsx
 * function ColorGrid({ colors, onSelect }) {
 *   const { focusedIndex, getItemRef, handleKeyDown, getTabIndex } = useRovingTabindex({
 *     itemCount: colors.length,
 *     isActive: true,
 *     onSelect: (index) => onSelect(colors[index]),
 *   });
 *
 *   return (
 *     <div role="listbox" onKeyDown={handleKeyDown}>
 *       {colors.map((color, index) => (
 *         <button
 *           key={color.id}
 *           ref={getItemRef(index)}
 *           tabIndex={getTabIndex(index)}
 *           aria-selected={index === focusedIndex}
 *         >
 *           {color.name}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRovingTabindex<T extends HTMLElement = HTMLElement>(
  options: UseRovingTabindexOptions
): UseRovingTabindexReturn<T> {
  const {
    itemCount,
    isActive,
    initialIndex = 0,
    wrap = true,
    onSelect,
    onEscape,
    disabled = false,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const itemRefs = useRef<(T | null)[]>([]);

  // Initialize focused index when becoming active
  useEffect(() => {
    if (isActive) {
      const startIndex = initialIndex >= 0 && initialIndex < itemCount ? initialIndex : 0;
      setFocusedIndex(startIndex);
    } else {
      setFocusedIndex(-1);
    }
  }, [isActive, initialIndex, itemCount]);

  // Focus the item when focusedIndex changes
  useEffect(() => {
    if (isActive && focusedIndex >= 0 && focusedIndex < itemCount) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [isActive, focusedIndex, itemCount]);

  // Create ref callback for collecting item refs
  const getItemRef = useCallback((index: number) => {
    return (el: T | null) => {
      itemRefs.current[index] = el;
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isActive || disabled || itemCount === 0) return;

    const navigate = (delta: number) => {
      e.preventDefault();
      setFocusedIndex(prev => {
        if (wrap) {
          return (prev + delta + itemCount) % itemCount;
        } else {
          const next = prev + delta;
          return Math.max(0, Math.min(itemCount - 1, next));
        }
      });
    };

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        navigate(1);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        navigate(-1);
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(itemCount - 1);
        break;

      case 'Enter':
      case ' ':
        if (focusedIndex >= 0 && onSelect) {
          e.preventDefault();
          onSelect(focusedIndex);
        }
        break;

      case 'Escape':
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        break;
    }
  }, [isActive, disabled, itemCount, wrap, focusedIndex, onSelect, onEscape]);

  // Get tabIndex for an item
  const getTabIndex = useCallback((index: number): 0 | -1 => {
    return index === focusedIndex ? 0 : -1;
  }, [focusedIndex]);

  return {
    focusedIndex,
    setFocusedIndex,
    getItemRef,
    handleKeyDown,
    getTabIndex,
  };
}

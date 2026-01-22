'use client';

import { useEffect, RefObject } from 'react';

/**
 * Selector for focusable elements within a container.
 * Matches buttons, links, inputs, selects, textareas, and elements with explicit tabindex.
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A hook that traps focus within a container element when active.
 * When the user tabs past the last focusable element, focus wraps to the first.
 * When the user shift-tabs past the first focusable element, focus wraps to the last.
 *
 * @param ref - A ref to the container element that should trap focus
 * @param isActive - Whether the focus trap is currently active (e.g., modal is open)
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const modalRef = useRef<HTMLDivElement>(null);
 *   useFocusTrap(modalRef, isOpen);
 *
 *   return (
 *     <div ref={modalRef} role="dialog" aria-modal="true">
 *       <button>First</button>
 *       <button>Last</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean
): void {
  useEffect(() => {
    if (!isActive || !ref.current) return;

    const container = ref.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ref, isActive]);
}

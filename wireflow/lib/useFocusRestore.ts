'use client';

import { useEffect, useRef } from 'react';

/**
 * A hook that saves the currently focused element when activated and restores
 * focus to that element when deactivated. Useful for modals and dialogs.
 *
 * @param isActive - Whether the component requiring focus restore is active (e.g., modal is open)
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   useFocusRestore(isOpen);
 *
 *   return isOpen ? (
 *     <div role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   ) : null;
 * }
 * ```
 */
export function useFocusRestore(isActive: boolean): void {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isActive) {
      // Store the currently focused element when becoming active
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      // Restore focus when becoming inactive
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isActive]);
}

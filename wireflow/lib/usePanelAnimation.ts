import { useState, useEffect } from 'react';

/**
 * Custom hook for managing panel animation timing.
 *
 * Ensures smooth panel transitions:
 * - When opening: Width animates first, content appears after animation completes
 * - When closing: Content hides immediately, then width animates
 *
 * @param isExpanded - Whether the panel should be expanded
 * @param animationDuration - Duration of width animation in ms (default: 200)
 * @returns Whether content should be visible
 */
export function usePanelAnimation(isExpanded: boolean, animationDuration: number = 200): boolean {
  const [contentVisible, setContentVisible] = useState(isExpanded);

  useEffect(() => {
    if (isExpanded) {
      // Opening: Wait for width animation to complete before showing content
      const timer = setTimeout(() => {
        setContentVisible(true);
      }, animationDuration);

      return () => clearTimeout(timer);
    } else {
      // Closing: Hide content immediately, width animation will run automatically
      setContentVisible(false);
    }
  }, [isExpanded, animationDuration]);

  return contentVisible;
}

'use client';

interface DividerProps {
  /** Orientation of the divider */
  orientation?: 'horizontal' | 'vertical';
  /** Additional className for custom styling */
  className?: string;
}

/**
 * Standard divider component for consistent visual separation.
 *
 * Usage:
 * - Horizontal: <Divider /> or <Divider orientation="horizontal" />
 * - Vertical: <Divider orientation="vertical" />
 */
export function Divider({ orientation = 'horizontal', className = '' }: DividerProps) {
  const baseStyles = 'bg-zinc-200 dark:bg-zinc-700 flex-shrink-0';

  const orientationStyles = orientation === 'horizontal'
    ? 'h-px w-full'
    : 'w-px h-6';

  return (
    <div
      className={`${baseStyles} ${orientationStyles} ${className}`}
      role="separator"
      aria-orientation={orientation}
    />
  );
}

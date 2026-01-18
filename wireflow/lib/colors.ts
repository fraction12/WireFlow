/**
 * Color palette constants for WireFlow
 * Phase 1 - Colors System
 */

// ============================================================================
// Types
// ============================================================================

/** Preset color with display name and hex value */
export interface PresetColor {
  name: string;
  hex: string;
}

// ============================================================================
// Color Palettes
// ============================================================================

/** 13 preset stroke colors for elements */
export const STROKE_COLORS: PresetColor[] = [
  { name: 'Black', hex: '#1e1e1e' },
  { name: 'Dark Gray', hex: '#6b7280' },
  { name: 'Gray', hex: '#9ca3af' },
  { name: 'Light Gray', hex: '#d1d5db' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
] as const;

/** Fill colors - same as stroke colors plus transparent */
export const FILL_COLORS: PresetColor[] = [
  { name: 'Transparent', hex: 'transparent' },
  ...STROKE_COLORS,
] as const;

// ============================================================================
// Default Values
// ============================================================================

/** Default stroke color (Dark Gray - matches existing sketch style) */
export const DEFAULT_STROKE_COLOR = '#6b7280';

/** Default fill color (transparent for wireframe style) */
export const DEFAULT_FILL_COLOR = 'transparent';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a contrasting text color (black or white) for a given background color
 * Uses relative luminance calculation for accessibility
 * @param hex - Hex color string (e.g., '#3b82f6' or 'transparent')
 * @returns '#ffffff' for dark backgrounds, '#1e1e1e' for light backgrounds
 */
export function getContrastColor(hex: string): string {
  // Handle transparent - use dark text
  if (hex === 'transparent' || !hex) {
    return '#1e1e1e';
  }

  // Remove # if present
  const color = hex.replace('#', '');

  // Parse RGB values
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, dark for light backgrounds
  return luminance > 0.5 ? '#1e1e1e' : '#ffffff';
}

/**
 * Find a preset color by hex value
 * @param hex - Hex color string to find
 * @param colors - Array of preset colors to search
 * @returns The matching PresetColor or undefined
 */
export function findPresetColor(hex: string, colors: readonly PresetColor[]): PresetColor | undefined {
  return colors.find(c => c.hex.toLowerCase() === hex.toLowerCase());
}

/**
 * Check if a color is a valid hex color or 'transparent'
 * @param color - Color string to validate
 * @returns true if valid
 */
export function isValidColor(color: string): boolean {
  if (color === 'transparent') return true;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

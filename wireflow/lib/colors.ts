/**
 * Color palette constants for WireFlow
 * Single source of truth for all color constants
 */

// ============================================================================
// Types
// ============================================================================

/** Preset color with display name and hex value */
export interface PresetColor {
  name: string;
  hex: string;
}

/** Color theme interface for canvas rendering */
export interface CanvasTheme {
  sketch: string;
  selected: string;
  selectedBg: string;
  hover: string;
  tagged: string;
  group: string;
  multiSelect: string;
  multiSelectBg: string;
  elementGroup: string;
  elementGroupBg: string;
  marqueeFill: string;
  marqueeStroke: string;
  handle: string;
  handleFill: string;
  grid: string;
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
// UI Colors (for canvas guides, overlays, and exports)
// ============================================================================

/** Alignment guide color (red/pink - visible during drag alignment) */
export const ALIGNMENT_GUIDE_COLOR = '#ff6b6b';

/** Grid snap guide color (sky blue - visible when snapping to grid) */
export const SNAP_GUIDE_COLOR = '#38bdf8';

/** Lock badge background color (red - indicates locked element) */
export const LOCK_BADGE_BG_COLOR = '#ef4444';

/** Lock badge icon color (white - lock icon on red badge) */
export const LOCK_BADGE_ICON_COLOR = '#ffffff';

/** Export background color (white - default background for PNG/SVG exports) */
export const EXPORT_BG_COLOR = '#ffffff';

/** Tagged element fill color (subtle green overlay for semantic elements) */
export const TAGGED_ELEMENT_BG_COLOR = 'rgba(16, 185, 129, 0.08)';

/** Generic white color for UI elements */
export const UI_WHITE = '#ffffff';

// ============================================================================
// Component Preview Colors (theme-aware colors for thumbnail rendering)
// ============================================================================

/** Component preview colors for light mode */
export const PREVIEW_COLORS_LIGHT = {
  stroke: '#71717a', // zinc-500
  text: '#27272a',   // zinc-800
  fill: 'rgba(244, 244, 245, 0.5)', // subtle zinc fill
} as const;

/** Component preview colors for dark mode */
export const PREVIEW_COLORS_DARK = {
  stroke: '#a1a1aa', // zinc-400
  text: '#e4e4e7',   // zinc-200
  fill: 'rgba(39, 39, 42, 0.3)', // subtle zinc fill
} as const;

/**
 * Get component preview colors based on theme
 * @param isDark - Whether dark mode is active
 */
export function getPreviewColors(isDark: boolean) {
  return isDark ? PREVIEW_COLORS_DARK : PREVIEW_COLORS_LIGHT;
}

// ============================================================================
// Canvas Theme Colors (synced with CSS variables in globals.css)
// ============================================================================

/** Default light theme colors for SSR and fallback */
export const DEFAULT_CANVAS_THEME: CanvasTheme = {
  sketch: '#6b7280',
  selected: '#3b82f6',
  selectedBg: 'rgba(59, 130, 246, 0.08)',
  hover: '#4b5563',
  tagged: '#10b981',
  group: '#8b5cf6',
  multiSelect: '#06b6d4',
  multiSelectBg: 'rgba(6, 182, 212, 0.08)',
  elementGroup: '#14b8a6',
  elementGroupBg: 'rgba(20, 184, 166, 0.08)',
  marqueeFill: 'rgba(59, 130, 246, 0.1)',
  marqueeStroke: '#3b82f6',
  handle: '#3b82f6',
  handleFill: '#ffffff',
  grid: 'rgba(150, 150, 150, 0.3)',
};

/**
 * Get canvas colors from CSS variables
 * Falls back to default theme during SSR
 */
export function getCanvasTheme(): CanvasTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_CANVAS_THEME;
  }

  const styles = getComputedStyle(document.documentElement);
  return {
    sketch: styles.getPropertyValue('--canvas-sketch').trim() || DEFAULT_CANVAS_THEME.sketch,
    selected: styles.getPropertyValue('--canvas-selected').trim() || DEFAULT_CANVAS_THEME.selected,
    selectedBg: styles.getPropertyValue('--canvas-selected-bg').trim() || DEFAULT_CANVAS_THEME.selectedBg,
    hover: styles.getPropertyValue('--canvas-hover').trim() || DEFAULT_CANVAS_THEME.hover,
    tagged: styles.getPropertyValue('--canvas-tagged').trim() || DEFAULT_CANVAS_THEME.tagged,
    group: styles.getPropertyValue('--canvas-group').trim() || DEFAULT_CANVAS_THEME.group,
    multiSelect: styles.getPropertyValue('--canvas-multi-select').trim() || DEFAULT_CANVAS_THEME.multiSelect,
    multiSelectBg: styles.getPropertyValue('--canvas-multi-select-bg').trim() || DEFAULT_CANVAS_THEME.multiSelectBg,
    elementGroup: styles.getPropertyValue('--canvas-element-group').trim() || DEFAULT_CANVAS_THEME.elementGroup,
    elementGroupBg: styles.getPropertyValue('--canvas-element-group-bg').trim() || DEFAULT_CANVAS_THEME.elementGroupBg,
    marqueeFill: styles.getPropertyValue('--canvas-marquee-fill').trim() || DEFAULT_CANVAS_THEME.marqueeFill,
    marqueeStroke: styles.getPropertyValue('--canvas-marquee-stroke').trim() || DEFAULT_CANVAS_THEME.marqueeStroke,
    handle: styles.getPropertyValue('--canvas-handle').trim() || DEFAULT_CANVAS_THEME.handle,
    handleFill: styles.getPropertyValue('--canvas-handle-fill').trim() || DEFAULT_CANVAS_THEME.handleFill,
    grid: styles.getPropertyValue('--canvas-grid').trim() || DEFAULT_CANVAS_THEME.grid,
  };
}

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

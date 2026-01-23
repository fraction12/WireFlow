/**
 * Canvas constants for sketch rendering and interaction
 * These values control the visual appearance and interaction behavior of the canvas
 *
 * NOTE: Color constants are centralized in lib/colors.ts
 * Import CanvasTheme, DEFAULT_CANVAS_THEME, getCanvasTheme from '@/lib/colors'
 */

// Re-export color types and functions from centralized location
export {
  type CanvasTheme,
  DEFAULT_CANVAS_THEME,
  getCanvasTheme
} from '@/lib/colors';

// ============================================================================
// Sketch Rendering Constants
// ============================================================================

/** Amplitude of the sketch-style wobble effect */
export const SKETCH_AMPLITUDE = 1.5;

/** Distance between segments when drawing sketch lines */
export const SEGMENT_DISTANCE = 20;

/** Length of arrow heads in pixels */
export const ARROW_HEAD_LENGTH = 15;

// ============================================================================
// Handle & Interaction Constants
// ============================================================================

/** Size of resize/rotation handles in pixels */
export const HANDLE_SIZE = 8;

/** Tolerance for handle hit detection in pixels */
export const HANDLE_TOLERANCE = 10;

/** Minimum size for any element in pixels */
export const MIN_ELEMENT_SIZE = 20;

/** Minimum drag distance required to create a shape (pixels) */
export const MIN_DRAG_DISTANCE = 5;

/** Default size for shapes created by clicking without dragging */
export const DEFAULT_CLICK_SHAPE_SIZE = 50;

/** Distance above element for the rotation handle */
export const ROTATION_HANDLE_OFFSET = 25;

// ============================================================================
// Selection Visual Constants
// ============================================================================

/** Padding around selected elements */
export const SELECTION_PADDING = 4;

/** Padding around group selections */
export const GROUP_SELECTION_PADDING = 6;

/** Padding around multi-selected elements */
export const MULTI_SELECT_PADDING = 5;

/** Dash pattern for selection outline [dash, gap] */
export const SELECTION_DASH_PATTERN: [number, number] = [4, 4];

/** Dash pattern for group outline [dash, gap] */
export const GROUP_DASH_PATTERN: [number, number] = [6, 4];

/** Dotted pattern for multi-selection [dash, gap] */
export const MULTI_SELECT_DASH_PATTERN: [number, number] = [2, 3];

/** Long dash pattern for element groups [dash, gap] */
export const ELEMENT_GROUP_DASH_PATTERN: [number, number] = [8, 3];

/** Line width for selection outline */
export const SELECTION_LINE_WIDTH = 2;

/** Line width for group outline */
export const GROUP_LINE_WIDTH = 1.5;

/** Line width for multi-selection outline */
export const MULTI_SELECT_LINE_WIDTH = 1.5;

/** Line width for element group outline */
export const ELEMENT_GROUP_LINE_WIDTH = 2;

// ============================================================================
// Canvas Theme Types & Defaults
// ============================================================================
// NOTE: CanvasTheme, DEFAULT_CANVAS_THEME, and getCanvasTheme are now
// re-exported from '@/lib/colors' at the top of this file for backwards
// compatibility. See lib/colors.ts for the source of truth.

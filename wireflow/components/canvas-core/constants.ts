/**
 * Canvas constants for sketch rendering and interaction
 * These values control the visual appearance and interaction behavior of the canvas
 */

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
}

/** Default light theme colors for SSR */
export const DEFAULT_CANVAS_THEME: CanvasTheme = {
  sketch: "#6b7280",
  selected: "#3b82f6",
  selectedBg: "rgba(59, 130, 246, 0.08)",
  hover: "#4b5563",
  tagged: "#10b981",
  group: "#8b5cf6",
  multiSelect: "#06b6d4",
  multiSelectBg: "rgba(6, 182, 212, 0.08)",
  elementGroup: "#14b8a6",
  elementGroupBg: "rgba(20, 184, 166, 0.08)",
  marqueeFill: "rgba(59, 130, 246, 0.1)",
  marqueeStroke: "#3b82f6",
  handle: "#3b82f6",
  handleFill: "#ffffff",
};

/**
 * Get canvas colors from CSS variables
 * Falls back to default theme during SSR
 */
export function getCanvasTheme(): CanvasTheme {
  if (typeof window === "undefined") {
    return DEFAULT_CANVAS_THEME;
  }

  const styles = getComputedStyle(document.documentElement);
  return {
    sketch: styles.getPropertyValue("--canvas-sketch").trim() || DEFAULT_CANVAS_THEME.sketch,
    selected: styles.getPropertyValue("--canvas-selected").trim() || DEFAULT_CANVAS_THEME.selected,
    selectedBg: styles.getPropertyValue("--canvas-selected-bg").trim() || DEFAULT_CANVAS_THEME.selectedBg,
    hover: styles.getPropertyValue("--canvas-hover").trim() || DEFAULT_CANVAS_THEME.hover,
    tagged: styles.getPropertyValue("--canvas-tagged").trim() || DEFAULT_CANVAS_THEME.tagged,
    group: styles.getPropertyValue("--canvas-group").trim() || DEFAULT_CANVAS_THEME.group,
    multiSelect: styles.getPropertyValue("--canvas-multi-select").trim() || DEFAULT_CANVAS_THEME.multiSelect,
    multiSelectBg: styles.getPropertyValue("--canvas-multi-select-bg").trim() || DEFAULT_CANVAS_THEME.multiSelectBg,
    elementGroup: styles.getPropertyValue("--canvas-element-group").trim() || DEFAULT_CANVAS_THEME.elementGroup,
    elementGroupBg: styles.getPropertyValue("--canvas-element-group-bg").trim() || DEFAULT_CANVAS_THEME.elementGroupBg,
    marqueeFill: styles.getPropertyValue("--canvas-marquee-fill").trim() || DEFAULT_CANVAS_THEME.marqueeFill,
    marqueeStroke: styles.getPropertyValue("--canvas-marquee-stroke").trim() || DEFAULT_CANVAS_THEME.marqueeStroke,
    handle: styles.getPropertyValue("--canvas-handle").trim() || DEFAULT_CANVAS_THEME.handle,
    handleFill: styles.getPropertyValue("--canvas-handle-fill").trim() || DEFAULT_CANVAS_THEME.handleFill,
  };
}

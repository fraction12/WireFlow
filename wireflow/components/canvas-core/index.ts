/**
 * Canvas module exports
 * Re-exports all canvas-related utilities, constants, and renderers
 */

// Constants
export {
  SKETCH_AMPLITUDE,
  SEGMENT_DISTANCE,
  ARROW_HEAD_LENGTH,
  HANDLE_SIZE,
  HANDLE_TOLERANCE,
  MIN_ELEMENT_SIZE,
  MIN_DRAG_DISTANCE,
  DEFAULT_CLICK_SHAPE_SIZE,
  ROTATION_HANDLE_OFFSET,
  SELECTION_PADDING,
  GROUP_SELECTION_PADDING,
  MULTI_SELECT_PADDING,
  SELECTION_DASH_PATTERN,
  GROUP_DASH_PATTERN,
  MULTI_SELECT_DASH_PATTERN,
  ELEMENT_GROUP_DASH_PATTERN,
  SELECTION_LINE_WIDTH,
  GROUP_LINE_WIDTH,
  MULTI_SELECT_LINE_WIDTH,
  ELEMENT_GROUP_LINE_WIDTH,
  DEFAULT_CANVAS_THEME,
  getCanvasTheme,
  type CanvasTheme,
} from './constants';

// Renderers
export {
  getRandomOffset,
  drawSketchLine,
  drawSketchRect,
  drawSketchEllipse,
  drawSketchDiamond,
  drawFreedraw,
  wrapText,
} from './renderers';

// Utilities
export {
  generateId,
  generateFrameId,
  CONTAINER_PADDING,
  isContainerElement,
  getBoundTextElement,
  calculateTextBoundsForContainer,
  syncBoundTextPosition,
  createBoundTextElement,
  type ContainerElement,
} from './utils';

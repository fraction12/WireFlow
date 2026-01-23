// Core element types for the canvas
export type ElementType = 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'arrow' | 'line' | 'freedraw';

// ============================================================================
// Element Style Types (Phase 1 - Colors)
// ============================================================================

/** Style properties for stroke and fill colors */
export interface ElementStyle {
  /** Stroke/outline color (default: '#6b7280') */
  strokeColor: string;
  /** Fill/background color (default: 'transparent') */
  fillColor: string;
}

// ============================================================================
// Documentation Types (Phase 1 - Documentation Panel)
// ============================================================================

/** Annotation for a specific element within a frame */
export interface ElementAnnotation {
  /** Brief description of the element's purpose */
  description: string;
  /** Expected behavior/interactions */
  behavior: string;
  /** Edge cases and special handling notes */
  edgeCases: string;
}

/** Frame-level documentation with element annotations */
export interface FrameDocumentation {
  /** General notes about the frame */
  notes: string;
  /** Element-specific annotations keyed by element ID */
  elementAnnotations: Record<string, ElementAnnotation>;
}

// Semantic tags for PM layer
export type SemanticTag =
  | 'button'
  | 'input'
  | 'section'
  | 'heading'
  | 'nav'
  | 'link'
  | 'listitem'
  | 'dialog'
  | 'table'
  | null;

// Text formatting types
export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | 'bold';
export type FontStyle = 'normal' | 'italic';
export type TextPreset = 'heading1' | 'heading2' | 'heading3' | 'body' | 'label' | 'caption';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

// Bound element reference (for shapes with text inside)
export interface BoundElement {
  id: string;
  type: 'text';
}

// Component types for component library
export type ComponentType =
  | 'table'
  | 'table-filters'
  | 'empty-state'
  | 'confirmation-modal'
  | 'simple-form'
  | 'action-footer'
  // Phase 1 - Core templates
  | 'button'
  | 'text-input'
  | 'dropdown'
  | 'card'
  | 'navigation-bar'
  | 'modal-dialog'
  | 'list-item'
  | 'header'
  | 'footer';

// Base properties for all canvas elements
export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  // Rotation angle in radians (0 = no rotation)
  rotation?: number;
  // Element styling (stroke and fill colors)
  style?: ElementStyle;
  // PM Layer - optional semantic information
  semanticTag?: SemanticTag;
  description?: string;
  intendedBehavior?: string;
  acceptanceNotes?: string;
  // Component grouping support (for component templates)
  groupId?: string;
  componentType?: ComponentType;
  // User-created grouping support
  elementGroupId?: string;
  // Bound elements (e.g., text inside shapes) - Excalidraw-style
  boundElements?: BoundElement[];
  // Layers panel properties
  /** Custom display name for element in layers panel */
  name?: string;
  /** Whether element is visible on canvas (default: true) */
  visible?: boolean;
  /** Whether element is locked from editing (default: false) */
  locked?: boolean;
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
}

export interface DiamondElement extends BaseElement {
  type: 'diamond';
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize?: number;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  textAlign?: TextAlign;
  lineHeight?: number;
  preset?: TextPreset;
  autoWidth?: boolean; // When true, element width auto-expands with content
  // Container binding (Excalidraw-style bound text)
  containerId?: string; // ID of the shape containing this text
  verticalAlign?: VerticalAlign; // Vertical alignment within container
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface FreedrawElement extends BaseElement {
  type: 'freedraw';
  points: { x: number; y: number }[]; // Raw points in canvas coordinates
}

export type CanvasElement = RectangleElement | EllipseElement | DiamondElement | TextElement | ArrowElement | LineElement | FreedrawElement;

// Tool types (Excalidraw-style)
export type Tool =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'text'
  | 'freedraw';

// Frame types for classification
export type FrameType = 'page' | 'modal' | 'flyout';

// Frame container
export interface Frame {
  id: string;
  name: string;
  type: FrameType;
  elements: CanvasElement[];
  createdAt: string;
  // Frame documentation (notes and element annotations)
  documentation?: FrameDocumentation;
}

// Export format for tagged elements only
export interface ExportedElement {
  id: string;
  type: ElementType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  semanticTag: SemanticTag;
  annotations: {
    description?: string;
    intendedBehavior?: string;
    acceptanceNotes?: string;
  };
  content?: string; // For text elements
  componentType?: ComponentType;
  groupId?: string; // Component group ID
  elementGroupId?: string; // User-created group ID
}

// Export format - now includes frames
export interface FrameExport {
  id: string;
  name: string;
  type: FrameType;
  taggedElements: ExportedElement[];
}

export interface ExportData {
  version: string;
  exportedAt: string;
  frames: FrameExport[];
}

// Component template system
export interface ComponentElementTemplate {
  type: ElementType;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  semanticTag?: SemanticTag;
  description?: string;
  content?: string; // For text elements
  textAlign?: TextAlign; // For text elements
  // Line/Arrow specific (relative to component origin)
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

export interface ComponentTemplate {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  width: number;
  height: number;
  elements: ComponentElementTemplate[];
}

export interface ComponentGroup {
  id: string;
  componentType: ComponentType;
  x: number;
  y: number;
  elementIds: string[];
  createdAt: string;
}

// User-created element groups (lightweight association)
export interface ElementGroup {
  id: string;
  elementIds: string[];
  frameId: string; // Groups are scoped to a single frame
  createdAt: string;
  // Layers panel properties (matching element and instance behavior)
  /** Custom display name for group in layers panel */
  name?: string;
  /** Whether group is visible on canvas (default: true) - applies to all elements */
  visible?: boolean;
  /** Whether group is locked from editing (default: false) - applies to all elements */
  locked?: boolean;
}

// User-defined component (promoted from element group)
export interface UserComponent {
  id: string;
  name: string;
  description?: string;
  category?: string; // For organization in library
  thumbnail?: string; // Base64 preview image
  masterElements: ComponentElementDef[]; // Template definition
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

// Element definition within a user component (relative positioning)
export interface ComponentElementDef {
  id: string; // Stable ID within component
  type: ElementType;
  offsetX: number; // Relative to component origin
  offsetY: number;
  width: number;
  height: number;
  rotation?: number;
  // Type-specific properties
  content?: string; // For text
  fontSize?: number;
  fontWeight?: FontWeight;
  fontStyle?: FontStyle;
  textAlign?: TextAlign;
  lineHeight?: number;
  preset?: TextPreset;
  autoWidth?: boolean;
  semanticTag?: SemanticTag;
  description?: string;
  // Style properties
  style?: ElementStyle;
  // Arrow/line specific
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Freedraw specific
  points?: { x: number; y: number }[];
}

// Instance of a user component placed on canvas
export interface ComponentInstance {
  id: string;
  componentId: string; // Reference to UserComponent
  frameId: string; // Which frame it's placed in
  x: number;
  y: number;
  scale?: number; // Future: scale support
  overrides?: ComponentOverride[]; // Instance-level customizations
  createdAt: string;
  // Layers panel properties (matching element behavior)
  /** Custom display name for instance in layers panel (defaults to component name) */
  name?: string;
  /** Whether instance is visible on canvas (default: true) */
  visible?: boolean;
  /** Whether instance is locked from editing (default: false) */
  locked?: boolean;
}

// Override for a specific property on an element within an instance
export interface ComponentOverride {
  elementId: string; // Which element in the component
  property: string; // Which property to override (e.g., 'content' for text)
  value: string | number | boolean; // Override value
}

// Workspace state for persistence
export interface WorkspaceState {
  version: number;
  frames: Frame[];
  componentGroups: ComponentGroup[];
  elementGroups: ElementGroup[];
  userComponents: UserComponent[]; // User-created component library
  componentInstances: ComponentInstance[]; // All placed instances
  activeFrameId: string;
}

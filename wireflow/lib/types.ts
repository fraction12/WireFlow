// Core element types for the canvas
export type ElementType = 'rectangle' | 'text' | 'arrow';

// Semantic tags for PM layer
export type SemanticTag = 'button' | 'input' | 'section' | null;

// Component types for component library
export type ComponentType =
  | 'table'
  | 'table-filters'
  | 'empty-state'
  | 'confirmation-modal'
  | 'simple-form'
  | 'action-footer';

// Base properties for all canvas elements
export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  // PM Layer - optional semantic information
  semanticTag?: SemanticTag;
  description?: string;
  intendedBehavior?: string;
  acceptanceNotes?: string;
  // Grouping support
  groupId?: string;
  componentType?: ComponentType;
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize?: number;
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export type CanvasElement = RectangleElement | TextElement | ArrowElement;

// Tool types
export type Tool =
  | 'select'
  | 'rectangle'
  | 'text'
  | 'arrow'
  // Layout & Structure
  | 'section'
  | 'divider'
  // UI Intent
  | 'button'
  | 'input'
  | 'checkbox'
  // Annotation
  | 'callout'
  | 'badge';

// Frame types for classification
export type FrameType = 'page' | 'modal' | 'flyout';

// Frame container
export interface Frame {
  id: string;
  name: string;
  type: FrameType;
  elements: CanvasElement[];
  createdAt: string;
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
  groupId?: string;
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

// Workspace state for persistence
export interface WorkspaceState {
  version: number;
  frames: Frame[];
  componentGroups: ComponentGroup[];
  activeFrameId: string;
}

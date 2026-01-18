/**
 * Canvas utility functions
 * Pure helper functions for common canvas operations
 */

import type {
  CanvasElement,
  RectangleElement,
  EllipseElement,
  DiamondElement,
  TextElement,
} from '@/lib/types';
import { MIN_TEXT_WIDTH } from '@/lib/textMeasurement';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique ID for canvas elements
 */
export function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a unique ID for frames
 */
export function generateFrameId(): string {
  return `frame_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Bound Text Helpers (Excalidraw-style text inside shapes)
// ============================================================================

/** Container types that can have bound text */
export type ContainerElement = RectangleElement | EllipseElement | DiamondElement;

/** Padding inside containers for bound text */
export const CONTAINER_PADDING = 8;

/**
 * Check if an element is a container that can hold bound text
 */
export function isContainerElement(element: CanvasElement): element is ContainerElement {
  return element.type === 'rectangle' || element.type === 'ellipse' || element.type === 'diamond';
}

/**
 * Get the bound text element for a container
 */
export function getBoundTextElement(
  container: CanvasElement,
  allElements: CanvasElement[]
): TextElement | null {
  if (!container.boundElements || container.boundElements.length === 0) {
    return null;
  }
  const boundTextRef = container.boundElements.find(be => be.type === 'text');
  if (!boundTextRef) return null;

  const textElement = allElements.find(el => el.id === boundTextRef.id);
  return textElement?.type === 'text' ? textElement as TextElement : null;
}

/**
 * Calculate the text bounds for centering text inside a container
 */
export function calculateTextBoundsForContainer(
  container: CanvasElement,
  textContent: string,
  ctx: CanvasRenderingContext2D | null,
  fontSize: number = 16
): { x: number; y: number; width: number; height: number } {
  // Calculate available width inside container
  const availableWidth = container.width - CONTAINER_PADDING * 2;

  // Estimate text height based on number of lines
  let textHeight = fontSize * 1.5; // Default single line height
  if (ctx && textContent) {
    ctx.font = `${fontSize}px sans-serif`;
    const words = textContent.split(' ');
    let lines = 1;
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > availableWidth && currentLine) {
        lines++;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    textHeight = lines * fontSize * 1.5;
  }

  // Center text within container
  const textWidth = Math.max(availableWidth, MIN_TEXT_WIDTH);
  const textX = container.x + CONTAINER_PADDING;
  const textY = container.y + (container.height - textHeight) / 2;

  return {
    x: textX,
    y: textY,
    width: textWidth,
    height: textHeight
  };
}

/**
 * Sync bound text position when container moves or resizes
 */
export function syncBoundTextPosition(
  containerId: string,
  allElements: CanvasElement[]
): CanvasElement[] {
  const container = allElements.find(el => el.id === containerId);
  if (!container || !isContainerElement(container)) {
    return allElements;
  }

  const boundText = getBoundTextElement(container, allElements);
  if (!boundText) {
    return allElements;
  }

  // Calculate new position for bound text
  const textWidth = container.width - CONTAINER_PADDING * 2;
  const textX = container.x + CONTAINER_PADDING;

  // Center vertically based on text height
  const fontSize = boundText.fontSize || 16;
  const lineHeight = boundText.lineHeight || Math.round(fontSize * 1.5);
  const lines = (boundText.content || '').split('\n').length;
  const textHeight = lines * lineHeight;
  const textY = container.y + (container.height - textHeight) / 2;

  return allElements.map(el => {
    if (el.id === boundText.id) {
      return {
        ...el,
        x: textX,
        y: Math.max(container.y + CONTAINER_PADDING, textY),
        width: Math.max(textWidth, MIN_TEXT_WIDTH)
      };
    }
    return el;
  });
}

/**
 * Create a new bound text element for a container
 */
export function createBoundTextElement(
  container: CanvasElement,
  initialContent: string = ''
): TextElement {
  const fontSize = 16;
  const lineHeight = Math.round(fontSize * 1.5);

  const textWidth = container.width - CONTAINER_PADDING * 2;
  const textHeight = lineHeight;
  const textX = container.x + CONTAINER_PADDING;
  const textY = container.y + (container.height - textHeight) / 2;

  return {
    id: generateId(),
    type: 'text',
    x: textX,
    y: textY,
    width: Math.max(textWidth, MIN_TEXT_WIDTH),
    height: textHeight,
    content: initialContent,
    fontSize,
    lineHeight,
    textAlign: 'center',
    autoWidth: false, // Bound text should not auto-expand
    containerId: container.id,
    verticalAlign: 'middle'
  };
}

/**
 * Canvas rendering functions for sketch-style drawing
 * These functions draw elements with a hand-drawn aesthetic
 */

import { SKETCH_AMPLITUDE, SEGMENT_DISTANCE } from './constants';

/**
 * Get a deterministic random offset for sketch-style wobble
 * Uses a seeded pseudo-random approach for consistent rendering
 */
export function getRandomOffset(
  base: number,
  seed: number,
  amplitude: number = SKETCH_AMPLITUDE
): number {
  const pseudo = Math.sin(seed * 12.9898 + base * 78.233) * 43758.5453;
  return (pseudo - Math.floor(pseudo)) * amplitude - amplitude / 2;
}

/**
 * Draw a sketch-style line with wobble effect
 */
export function drawSketchLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number = 0
): void {
  const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  // Safety: Skip drawing degenerate (zero-length) lines
  if (distance < 1) return;

  const segments = Math.max(3, Math.floor(distance / SEGMENT_DISTANCE));

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;

    // Add controlled wobble perpendicular to the line direction
    const dx = x2 - x1;
    const dy = y2 - y1;
    const perpX = -dy / distance;
    const perpY = dx / distance;

    const wobble = getRandomOffset(i, seed + i * 7);
    const wobbledX = x + perpX * wobble;
    const wobbledY = y + perpY * wobble;

    ctx.lineTo(wobbledX, wobbledY);
  }

  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/**
 * Draw a sketch-style rectangle
 */
export function drawSketchRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number = 0
): void {
  // Draw four sides with slight variations
  drawSketchLine(ctx, x, y, x + width, y, seed); // Top
  drawSketchLine(ctx, x + width, y, x + width, y + height, seed + 1); // Right
  drawSketchLine(ctx, x + width, y + height, x, y + height, seed + 2); // Bottom
  drawSketchLine(ctx, x, y + height, x, y, seed + 3); // Left
}

/**
 * Draw a sketch-style ellipse
 */
export function drawSketchEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number = 0
): void {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radiusX = width / 2;
  const radiusY = height / 2;
  const segments = Math.max(24, Math.floor((radiusX + radiusY) / 4));

  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const baseX = centerX + radiusX * Math.cos(angle);
    const baseY = centerY + radiusY * Math.sin(angle);

    // Add wobble perpendicular to the ellipse curve
    const wobble = getRandomOffset(i, seed + i * 7);
    const wobbledX = baseX + wobble * Math.cos(angle);
    const wobbledY = baseY + wobble * Math.sin(angle);

    if (i === 0) {
      ctx.moveTo(wobbledX, wobbledY);
    } else {
      ctx.lineTo(wobbledX, wobbledY);
    }
  }
  ctx.closePath();
  ctx.stroke();
}

/**
 * Draw a sketch-style diamond (rhombus) shape
 */
export function drawSketchDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number = 0
): void {
  // Diamond points: top, right, bottom, left (center-aligned)
  const topX = x + width / 2;
  const topY = y;
  const rightX = x + width;
  const rightY = y + height / 2;
  const bottomX = x + width / 2;
  const bottomY = y + height;
  const leftX = x;
  const leftY = y + height / 2;

  // Draw the four sides with sketch-style wobble
  drawSketchLine(ctx, topX, topY, rightX, rightY, seed); // Top-right edge
  drawSketchLine(ctx, rightX, rightY, bottomX, bottomY, seed + 1); // Bottom-right edge
  drawSketchLine(ctx, bottomX, bottomY, leftX, leftY, seed + 2); // Bottom-left edge
  drawSketchLine(ctx, leftX, leftY, topX, topY, seed + 3); // Top-left edge
}

/**
 * Draw a freehand path with smooth curves
 */
export function drawFreedraw(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[]
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  // Use quadratic curves for smooth rendering
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  // Draw to the last point
  if (points.length > 1) {
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  ctx.stroke();
}

/**
 * Wrap text to fit within a given width, returning an array of lines
 * Handles both explicit newlines, word-wrapping, and character-level breaks for very long words
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  // Helper to break a long word character-by-character
  const breakLongWord = (word: string): string[] => {
    const brokenParts: string[] = [];
    let currentPart = "";

    for (const char of word) {
      const testPart = currentPart + char;
      const metrics = ctx.measureText(testPart);

      if (metrics.width > maxWidth && currentPart) {
        brokenParts.push(currentPart);
        currentPart = char;
      } else {
        currentPart = testPart;
      }
    }

    if (currentPart) {
      brokenParts.push(currentPart);
    }

    return brokenParts;
  };

  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      // Check if the word itself is too long to fit on a line
      const wordMetrics = ctx.measureText(word);
      if (wordMetrics.width > maxWidth) {
        // Push current line if any
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }
        // Break the long word into parts
        const wordParts = breakLongWord(word);
        // Add all parts except the last as separate lines
        for (let i = 0; i < wordParts.length - 1; i++) {
          lines.push(wordParts[i]);
        }
        // The last part becomes the current line (may be combined with next word)
        currentLine = wordParts[wordParts.length - 1] || "";
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [""];
}

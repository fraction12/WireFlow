// Text measurement utility for auto-width calculation
// Uses a hidden canvas to measure text dimensions accurately

export const MIN_TEXT_WIDTH = 20;
export const TEXT_PADDING = 4;
export const AUTO_WIDTH_BUFFER = 8;

let measureCanvas: HTMLCanvasElement | null = null;

export interface MeasureTextOptions {
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
}

/**
 * Measures the width of text using canvas measureText API
 * This ensures accurate measurement matching the canvas rendering
 */
export function measureTextWidth(
  text: string,
  options: MeasureTextOptions
): number {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
  }
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return MIN_TEXT_WIDTH;

  const fontString = `${options.fontStyle === 'italic' ? 'italic ' : ''}${options.fontWeight === 'bold' ? 'bold ' : ''}${options.fontSize}px sans-serif`;
  ctx.font = fontString;

  // For multiline text, measure each line and return the max width
  const lines = text.split('\n');
  let maxWidth = 0;
  for (const line of lines) {
    const width = ctx.measureText(line || ' ').width;
    if (width > maxWidth) {
      maxWidth = width;
    }
  }

  return maxWidth;
}

/**
 * Calculates the required element width for auto-width text
 */
export function calculateAutoWidth(
  text: string,
  options: MeasureTextOptions
): number {
  const measuredWidth = measureTextWidth(text, options);
  return Math.max(MIN_TEXT_WIDTH, measuredWidth + TEXT_PADDING * 2 + AUTO_WIDTH_BUFFER);
}

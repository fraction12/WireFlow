// Text measurement utility for auto-width calculation
// Uses a hidden canvas to measure text dimensions accurately

export const MIN_TEXT_WIDTH = 20;
export const TEXT_PADDING = 4;
export const AUTO_WIDTH_BUFFER = 8;

let measureCanvas: HTMLCanvasElement | null = null;

// Cache for text measurements keyed by content+font
// Uses proper LRU eviction: Map maintains insertion order, and we
// re-insert on access to move entries to the end (most recently used)
const measurementCache = new Map<string, number>();
const MAX_CACHE_SIZE = 500;
const EVICTION_BATCH_SIZE = 100;

/**
 * Creates a cache key from text content and font options
 */
function createCacheKey(text: string, options: MeasureTextOptions): string {
  return `${text}|${options.fontSize}|${options.fontWeight}|${options.fontStyle}`;
}

/**
 * Evicts oldest (least recently used) entries when cache exceeds max size.
 * In a Map, iteration order is insertion order, and we re-insert on access,
 * so the first entries are the least recently used.
 */
function evictOldestEntries(): void {
  if (measurementCache.size > MAX_CACHE_SIZE) {
    // Delete first N entries (least recently used)
    const keysToDelete = Array.from(measurementCache.keys()).slice(0, EVICTION_BATCH_SIZE);
    keysToDelete.forEach(key => measurementCache.delete(key));
  }
}

export interface MeasureTextOptions {
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
}

/**
 * Measures the width of text using canvas measureText API
 * This ensures accurate measurement matching the canvas rendering
 * Results are cached by content+font for performance with proper LRU eviction
 */
export function measureTextWidth(
  text: string,
  options: MeasureTextOptions
): number {
  // Check cache first
  const cacheKey = createCacheKey(text, options);
  const cached = measurementCache.get(cacheKey);
  if (cached !== undefined) {
    // LRU update: delete and re-insert to move to end (most recently used)
    measurementCache.delete(cacheKey);
    measurementCache.set(cacheKey, cached);
    return cached;
  }

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

  // Cache the result
  measurementCache.set(cacheKey, maxWidth);
  evictOldestEntries();

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

/**
 * Cleans up the module-level canvas to free memory.
 * Call this when the application unmounts or during cleanup.
 */
export function cleanupMeasureCanvas(): void {
  measureCanvas = null;
}

/**
 * Clears the measurement cache.
 * Useful for testing or when font metrics might have changed.
 */
export function clearMeasurementCache(): void {
  measurementCache.clear();
}

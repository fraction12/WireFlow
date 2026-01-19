/**
 * Shared types for MCP tool inputs/outputs
 */
import { z } from "zod";
// Canvas coordinate bounds
export const CANVAS_MIN = 0;
export const CANVAS_MAX = 2000;
// Common validation schemas
export const coordinateSchema = z.number().min(CANVAS_MIN).max(CANVAS_MAX);
export const dimensionSchema = z.number().min(1).max(CANVAS_MAX);
export const colorSchema = z.string().optional();
export const elementIdSchema = z.string().min(1);
export const frameIdSchema = z.string().optional();
// Schemas for each tool
export const createRectangleSchema = z.object({
    x: coordinateSchema.describe("X coordinate (0-2000)"),
    y: coordinateSchema.describe("Y coordinate (0-2000)"),
    width: dimensionSchema.describe("Width in pixels"),
    height: dimensionSchema.describe("Height in pixels"),
    strokeColor: colorSchema.describe("Stroke color (hex or named color)"),
    fillColor: colorSchema.describe("Fill color (hex, named, or 'transparent')"),
});
export const createEllipseSchema = z.object({
    x: coordinateSchema.describe("X coordinate (0-2000)"),
    y: coordinateSchema.describe("Y coordinate (0-2000)"),
    width: dimensionSchema.describe("Width in pixels"),
    height: dimensionSchema.describe("Height in pixels"),
    strokeColor: colorSchema.describe("Stroke color (hex or named color)"),
    fillColor: colorSchema.describe("Fill color (hex, named, or 'transparent')"),
});
export const createTextSchema = z.object({
    x: coordinateSchema.describe("X coordinate (0-2000)"),
    y: coordinateSchema.describe("Y coordinate (0-2000)"),
    content: z.string().min(1).describe("Text content"),
    fontSize: z.number().min(8).max(128).optional().describe("Font size in pixels (default: 16)"),
    textAlign: z.enum(["left", "center", "right"]).optional().describe("Text alignment"),
});
export const createArrowSchema = z.object({
    startX: coordinateSchema.describe("Start X coordinate (0-2000)"),
    startY: coordinateSchema.describe("Start Y coordinate (0-2000)"),
    endX: coordinateSchema.describe("End X coordinate (0-2000)"),
    endY: coordinateSchema.describe("End Y coordinate (0-2000)"),
    strokeColor: colorSchema.describe("Stroke color (hex or named color)"),
});
export const createLineSchema = z.object({
    startX: coordinateSchema.describe("Start X coordinate (0-2000)"),
    startY: coordinateSchema.describe("Start Y coordinate (0-2000)"),
    endX: coordinateSchema.describe("End X coordinate (0-2000)"),
    endY: coordinateSchema.describe("End Y coordinate (0-2000)"),
    strokeColor: colorSchema.describe("Stroke color (hex or named color)"),
});
export const updateElementSchema = z.object({
    elementId: elementIdSchema.describe("ID of the element to update"),
    x: coordinateSchema.optional().describe("New X coordinate"),
    y: coordinateSchema.optional().describe("New Y coordinate"),
    width: dimensionSchema.optional().describe("New width"),
    height: dimensionSchema.optional().describe("New height"),
    strokeColor: colorSchema.describe("New stroke color"),
    fillColor: colorSchema.describe("New fill color"),
    content: z.string().optional().describe("New text content (for text elements)"),
    fontSize: z.number().optional().describe("New font size (for text elements)"),
});
export const deleteElementsSchema = z.object({
    elementIds: z.array(elementIdSchema).min(1).describe("Array of element IDs to delete"),
});
export const selectElementsSchema = z.object({
    elementIds: z.array(elementIdSchema).describe("Array of element IDs to select (empty to clear)"),
});
export const getElementsSchema = z.object({
    frameId: frameIdSchema.describe("Optional frame ID (defaults to active frame)"),
});
export const createComponentSchema = z.object({
    templateType: z.string().describe("Component template type (e.g., 'button', 'card', 'text-input')"),
    x: coordinateSchema.describe("X coordinate for component placement"),
    y: coordinateSchema.describe("Y coordinate for component placement"),
});
export const switchFrameSchema = z.object({
    frameId: z.string().min(1).describe("ID of the frame to switch to"),
});
export const createFrameSchema = z.object({
    name: z.string().min(1).describe("Name for the new frame"),
    frameType: z.enum(["page", "modal", "flyout"]).optional().describe("Type of frame (default: 'page')"),
});
//# sourceMappingURL=types.js.map
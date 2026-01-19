/**
 * Shared types for MCP tool inputs/outputs
 */
import { z } from "zod";
export declare const CANVAS_MIN = 0;
export declare const CANVAS_MAX = 2000;
export declare const coordinateSchema: z.ZodNumber;
export declare const dimensionSchema: z.ZodNumber;
export declare const colorSchema: z.ZodOptional<z.ZodString>;
export declare const elementIdSchema: z.ZodString;
export declare const frameIdSchema: z.ZodOptional<z.ZodString>;
export declare const createRectangleSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    strokeColor: z.ZodOptional<z.ZodString>;
    fillColor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor?: string | undefined;
    fillColor?: string | undefined;
}, {
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor?: string | undefined;
    fillColor?: string | undefined;
}>;
export declare const createEllipseSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    strokeColor: z.ZodOptional<z.ZodString>;
    fillColor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor?: string | undefined;
    fillColor?: string | undefined;
}, {
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor?: string | undefined;
    fillColor?: string | undefined;
}>;
export declare const createTextSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    content: z.ZodString;
    fontSize: z.ZodOptional<z.ZodNumber>;
    textAlign: z.ZodOptional<z.ZodEnum<["left", "center", "right"]>>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    content: string;
    fontSize?: number | undefined;
    textAlign?: "left" | "center" | "right" | undefined;
}, {
    x: number;
    y: number;
    content: string;
    fontSize?: number | undefined;
    textAlign?: "left" | "center" | "right" | undefined;
}>;
export declare const createArrowSchema: z.ZodObject<{
    startX: z.ZodNumber;
    startY: z.ZodNumber;
    endX: z.ZodNumber;
    endY: z.ZodNumber;
    strokeColor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string | undefined;
}, {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string | undefined;
}>;
export declare const createLineSchema: z.ZodObject<{
    startX: z.ZodNumber;
    startY: z.ZodNumber;
    endX: z.ZodNumber;
    endY: z.ZodNumber;
    strokeColor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string | undefined;
}, {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string | undefined;
}>;
export declare const updateElementSchema: z.ZodObject<{
    elementId: z.ZodString;
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    strokeColor: z.ZodOptional<z.ZodString>;
    fillColor: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    fontSize: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    elementId: string;
    x?: number | undefined;
    y?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    strokeColor?: string | undefined;
    fillColor?: string | undefined;
    content?: string | undefined;
    fontSize?: number | undefined;
}, {
    elementId: string;
    x?: number | undefined;
    y?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    strokeColor?: string | undefined;
    fillColor?: string | undefined;
    content?: string | undefined;
    fontSize?: number | undefined;
}>;
export declare const deleteElementsSchema: z.ZodObject<{
    elementIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    elementIds: string[];
}, {
    elementIds: string[];
}>;
export declare const selectElementsSchema: z.ZodObject<{
    elementIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    elementIds: string[];
}, {
    elementIds: string[];
}>;
export declare const getElementsSchema: z.ZodObject<{
    frameId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    frameId?: string | undefined;
}, {
    frameId?: string | undefined;
}>;
export declare const createComponentSchema: z.ZodObject<{
    templateType: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    templateType: string;
}, {
    x: number;
    y: number;
    templateType: string;
}>;
export declare const switchFrameSchema: z.ZodObject<{
    frameId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    frameId: string;
}, {
    frameId: string;
}>;
export declare const createFrameSchema: z.ZodObject<{
    name: z.ZodString;
    frameType: z.ZodOptional<z.ZodEnum<["page", "modal", "flyout"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    frameType?: "page" | "modal" | "flyout" | undefined;
}, {
    name: string;
    frameType?: "page" | "modal" | "flyout" | undefined;
}>;
export type CreateRectangleInput = z.infer<typeof createRectangleSchema>;
export type CreateEllipseInput = z.infer<typeof createEllipseSchema>;
export type CreateTextInput = z.infer<typeof createTextSchema>;
export type CreateArrowInput = z.infer<typeof createArrowSchema>;
export type CreateLineInput = z.infer<typeof createLineSchema>;
export type UpdateElementInput = z.infer<typeof updateElementSchema>;
export type DeleteElementsInput = z.infer<typeof deleteElementsSchema>;
export type SelectElementsInput = z.infer<typeof selectElementsSchema>;
export type GetElementsInput = z.infer<typeof getElementsSchema>;
export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type SwitchFrameInput = z.infer<typeof switchFrameSchema>;
export type CreateFrameInput = z.infer<typeof createFrameSchema>;
//# sourceMappingURL=types.d.ts.map
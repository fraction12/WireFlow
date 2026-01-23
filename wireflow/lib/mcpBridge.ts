/**
 * MCP Bridge - WebSocket client for WireFlow browser app
 * Connects to MCP server and handles commands
 */

import { useEffect, useRef, useCallback } from "react";
import type {
  CanvasElement,
  Frame,
  ComponentGroup,
  ElementGroup,
  UserComponent,
  ComponentInstance,
  FrameType,
  WorkspaceState,
} from "./types";
import { COMPONENT_TEMPLATES } from "./componentTemplates";
import { DEFAULT_STROKE_COLOR, DEFAULT_FILL_COLOR } from "./colors";

// ============================================================
// Types
// ============================================================

interface MCPRequest {
  type: string;
  correlationId: string;
  timestamp: string;
  [key: string]: unknown;
}

interface MCPResponse {
  type: string;
  correlationId: string;
  timestamp: string;
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface MCPBridgeCallbacks {
  // State getters
  getState: () => {
    frames: Frame[];
    activeFrameId: string;
    componentGroups: ComponentGroup[];
    elementGroups: ElementGroup[];
    userComponents: UserComponent[];
    componentInstances: ComponentInstance[];
  };
  getElements: () => CanvasElement[];
  getSelectedElementIds: () => string[];

  // State mutators
  recordSnapshot: () => void;
  setElements: (
    elements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[])
  ) => void;
  setSelectedElementIds: (ids: Set<string>) => void;
  setSelectedElementId: (id: string | null) => void;

  // Frame operations
  setActiveFrameId: (frameId: string) => void;
  addFrame: (name: string, frameType: FrameType) => string;

  // Component operations
  createComponentGroup: (
    templateType: string,
    x: number,
    y: number
  ) => { elementIds: string[]; groupId: string } | null;

  // ID generators
  generateId: () => string;
  generateFrameId: () => string;
}

// ============================================================
// Hook
// ============================================================

export function useMCPBridge(
  callbacks: MCPBridgeCallbacks,
  enabled: boolean = true
): { isConnected: boolean } {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isConnectedRef = useRef(false);
  const hasLoggedDisconnectRef = useRef(false);

  const config = {
    url: "ws://localhost:3001",
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2,
  };

  // Store callbacks in ref to avoid dependency issues
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const request = JSON.parse(event.data) as MCPRequest;
      const response = processRequest(request, callbacksRef.current);
      wsRef.current?.send(JSON.stringify(response));
    } catch (error) {
      console.error("[MCP Bridge] Failed to handle message:", error);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      const ws = new WebSocket(config.url);

      ws.onopen = () => {
        console.log("[MCP Bridge] Connected to MCP server on port 3001");
        reconnectAttemptRef.current = 0;
        isConnectedRef.current = true;
        hasLoggedDisconnectRef.current = false;

        // Send connected event
        ws.send(
          JSON.stringify({
            type: "client_connected",
            timestamp: new Date().toISOString(),
            data: {
              clientInfo: {
                userAgent: navigator.userAgent,
                url: window.location.href,
              },
            },
          })
        );
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        const wasConnected = isConnectedRef.current;
        isConnectedRef.current = false;
        wsRef.current = null;

        // Only log disconnection if we were previously connected
        if (wasConnected) {
          console.log("[MCP Bridge] Disconnected from MCP server");
        }

        // Attempt reconnect if not intentional close
        if (event.code !== 1000 && enabled) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // Only log once per session to avoid console spam
        if (!hasLoggedDisconnectRef.current) {
          hasLoggedDisconnectRef.current = true;
          console.log("[MCP Bridge] MCP server not available at ws://localhost:3001 - will retry in background");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[MCP Bridge] Connection failed:", error);
      scheduleReconnect();
    }
  }, [enabled, handleMessage]);

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(
      config.initialDelay *
        Math.pow(config.backoffMultiplier, reconnectAttemptRef.current),
      config.maxDelay
    );

    // Only log reconnect attempts occasionally to reduce noise
    if (reconnectAttemptRef.current === 0 || reconnectAttemptRef.current % 5 === 0) {
      console.log(`[MCP Bridge] Will retry connection in ${Math.round(delay / 1000)}s`);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptRef.current++;
      connect();
    }, delay);
  }, [connect]);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
      }
    };
  }, [enabled, connect]);

  return { isConnected: isConnectedRef.current };
}

// ============================================================
// Request Processing
// ============================================================

function processRequest(
  request: MCPRequest,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const { type, correlationId } = request;
  const timestamp = new Date().toISOString();

  try {
    switch (type) {
      case "ping":
        return {
          type: "pong",
          correlationId,
          timestamp,
          success: true,
        };

      case "get_state":
        return handleGetState(correlationId, timestamp, callbacks);

      case "get_elements":
        return handleGetElements(correlationId, timestamp, callbacks);

      case "get_selection":
        return handleGetSelection(correlationId, timestamp, callbacks);

      case "create_rectangle":
        return handleCreateRectangle(
          request,
          correlationId,
          timestamp,
          callbacks
        );

      case "create_ellipse":
        return handleCreateEllipse(
          request,
          correlationId,
          timestamp,
          callbacks
        );

      case "create_text":
        return handleCreateText(request, correlationId, timestamp, callbacks);

      case "create_arrow":
        return handleCreateArrow(request, correlationId, timestamp, callbacks);

      case "create_line":
        return handleCreateLine(request, correlationId, timestamp, callbacks);

      case "update_element":
        return handleUpdateElement(
          request,
          correlationId,
          timestamp,
          callbacks
        );

      case "delete_elements":
        return handleDeleteElements(
          request,
          correlationId,
          timestamp,
          callbacks
        );

      case "delete_selected":
        return handleDeleteSelected(correlationId, timestamp, callbacks);

      case "select_elements":
        return handleSelectElements(
          request,
          correlationId,
          timestamp,
          callbacks
        );

      case "clear_selection":
        return handleClearSelection(correlationId, timestamp, callbacks);

      case "list_components":
        return handleListComponents(correlationId, timestamp);

      case "create_component":
        return handleCreateComponent(
          request,
          correlationId,
          timestamp,
          callbacks
        );

      case "list_frames":
        return handleListFrames(correlationId, timestamp, callbacks);

      case "switch_frame":
        return handleSwitchFrame(request, correlationId, timestamp, callbacks);

      case "create_frame":
        return handleCreateFrame(request, correlationId, timestamp, callbacks);

      default:
        return {
          type: "error",
          correlationId,
          timestamp,
          success: false,
          error: {
            code: "UNKNOWN_TYPE",
            message: `Unknown request type: ${type}`,
          },
        };
    }
  } catch (error) {
    return {
      type: "error",
      correlationId,
      timestamp,
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

// ============================================================
// Validation Helpers
// ============================================================

const CANVAS_MIN = 0;
const CANVAS_MAX = 2000;
const MIN_DIMENSION = 1;

interface ValidationResult {
  valid: boolean;
  error?: { code: string; message: string };
}

function validateCoordinates(x: number, y: number): ValidationResult {
  if (typeof x !== "number" || typeof y !== "number" || isNaN(x) || isNaN(y)) {
    return {
      valid: false,
      error: { code: "INVALID_COORDINATES", message: "Coordinates must be valid numbers" },
    };
  }
  if (x < CANVAS_MIN || x > CANVAS_MAX || y < CANVAS_MIN || y > CANVAS_MAX) {
    return {
      valid: false,
      error: {
        code: "OUT_OF_BOUNDS",
        message: `Coordinates must be between ${CANVAS_MIN} and ${CANVAS_MAX}. Got x=${x}, y=${y}`,
      },
    };
  }
  return { valid: true };
}

function validateDimensions(width: number, height: number): ValidationResult {
  if (typeof width !== "number" || typeof height !== "number" || isNaN(width) || isNaN(height)) {
    return {
      valid: false,
      error: { code: "INVALID_DIMENSIONS", message: "Dimensions must be valid numbers" },
    };
  }
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return {
      valid: false,
      error: {
        code: "INVALID_DIMENSIONS",
        message: `Dimensions must be at least ${MIN_DIMENSION}. Got width=${width}, height=${height}`,
      },
    };
  }
  return { valid: true };
}

function clampToCanvas(value: number): number {
  return Math.max(CANVAS_MIN, Math.min(CANVAS_MAX, value));
}

// ============================================================
// Request Handlers
// ============================================================

function handleGetState(
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const state = callbacks.getState();
  const elements = callbacks.getElements();
  const selectedIds = callbacks.getSelectedElementIds();

  return {
    type: "state",
    correlationId,
    timestamp,
    success: true,
    data: {
      activeFrameId: state.activeFrameId,
      frames: state.frames.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        elementCount: f.elements.length,
      })),
      elementCount: elements.length,
      selectedElementIds: selectedIds,
      canUndo: true,
      canRedo: false,
    },
  };
}

function handleGetElements(
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const elements = callbacks.getElements();

  return {
    type: "elements",
    correlationId,
    timestamp,
    success: true,
    data: {
      elements: elements.map(serializeElement),
    },
  };
}

function handleGetSelection(
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const selectedIds = callbacks.getSelectedElementIds();

  return {
    type: "selection",
    correlationId,
    timestamp,
    success: true,
    data: {
      selectedIds,
    },
  };
}

function handleCreateRectangle(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const params = request.params as {
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor?: string;
    fillColor?: string;
  };

  // Validate before recording snapshot
  const coordValidation = validateCoordinates(params.x, params.y);
  if (!coordValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: coordValidation.error };
  }

  const dimValidation = validateDimensions(params.width, params.height);
  if (!dimValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: dimValidation.error };
  }

  callbacks.recordSnapshot();

  const id = callbacks.generateId();
  const newElement: CanvasElement = {
    id,
    type: "rectangle",
    x: clampToCanvas(params.x),
    y: clampToCanvas(params.y),
    width: params.width,
    height: params.height,
    style: {
      strokeColor: params.strokeColor || DEFAULT_STROKE_COLOR,
      fillColor: params.fillColor || "transparent",
    },
  };

  callbacks.setElements((prev) => [...prev, newElement]);

  return {
    type: "element_created",
    correlationId,
    timestamp,
    success: true,
    data: { elementId: id },
  };
}

function handleCreateEllipse(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const params = request.params as {
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor?: string;
    fillColor?: string;
  };

  // Validate before recording snapshot
  const coordValidation = validateCoordinates(params.x, params.y);
  if (!coordValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: coordValidation.error };
  }

  const dimValidation = validateDimensions(params.width, params.height);
  if (!dimValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: dimValidation.error };
  }

  callbacks.recordSnapshot();

  const id = callbacks.generateId();
  const newElement: CanvasElement = {
    id,
    type: "ellipse",
    x: clampToCanvas(params.x),
    y: clampToCanvas(params.y),
    width: params.width,
    height: params.height,
    style: {
      strokeColor: params.strokeColor || DEFAULT_STROKE_COLOR,
      fillColor: params.fillColor || "transparent",
    },
  };

  callbacks.setElements((prev) => [...prev, newElement]);

  return {
    type: "element_created",
    correlationId,
    timestamp,
    success: true,
    data: { elementId: id },
  };
}

function handleCreateText(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const params = request.params as {
    x: number;
    y: number;
    content: string;
    fontSize?: number;
    textAlign?: "left" | "center" | "right";
  };

  // Validate before recording snapshot
  const coordValidation = validateCoordinates(params.x, params.y);
  if (!coordValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: coordValidation.error };
  }

  callbacks.recordSnapshot();

  const id = callbacks.generateId();
  const newElement: CanvasElement = {
    id,
    type: "text",
    x: clampToCanvas(params.x),
    y: clampToCanvas(params.y),
    width: 100,
    height: 24,
    content: params.content,
    fontSize: params.fontSize || 16,
    textAlign: params.textAlign || "left",
    autoWidth: true,
  };

  callbacks.setElements((prev) => [...prev, newElement]);

  return {
    type: "element_created",
    correlationId,
    timestamp,
    success: true,
    data: { elementId: id },
  };
}

function handleCreateArrow(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const params = request.params as {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string;
  };

  // Validate before recording snapshot
  const startValidation = validateCoordinates(params.startX, params.startY);
  if (!startValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: startValidation.error };
  }
  const endValidation = validateCoordinates(params.endX, params.endY);
  if (!endValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: endValidation.error };
  }

  callbacks.recordSnapshot();

  const startX = clampToCanvas(params.startX);
  const startY = clampToCanvas(params.startY);
  const endX = clampToCanvas(params.endX);
  const endY = clampToCanvas(params.endY);

  const id = callbacks.generateId();
  const newElement: CanvasElement = {
    id,
    type: "arrow",
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX) || 1,
    height: Math.abs(endY - startY) || 1,
    startX,
    startY,
    endX,
    endY,
    style: {
      strokeColor: params.strokeColor || DEFAULT_STROKE_COLOR,
      fillColor: "transparent",
    },
  };

  callbacks.setElements((prev) => [...prev, newElement]);

  return {
    type: "element_created",
    correlationId,
    timestamp,
    success: true,
    data: { elementId: id },
  };
}

function handleCreateLine(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const params = request.params as {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string;
  };

  // Validate before recording snapshot
  const startValidation = validateCoordinates(params.startX, params.startY);
  if (!startValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: startValidation.error };
  }
  const endValidation = validateCoordinates(params.endX, params.endY);
  if (!endValidation.valid) {
    return { type: "error", correlationId, timestamp, success: false, error: endValidation.error };
  }

  callbacks.recordSnapshot();

  const startX = clampToCanvas(params.startX);
  const startY = clampToCanvas(params.startY);
  const endX = clampToCanvas(params.endX);
  const endY = clampToCanvas(params.endY);

  const id = callbacks.generateId();
  const newElement: CanvasElement = {
    id,
    type: "line",
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX) || 1,
    height: Math.abs(endY - startY) || 1,
    startX,
    startY,
    endX,
    endY,
    style: {
      strokeColor: params.strokeColor || DEFAULT_STROKE_COLOR,
      fillColor: "transparent",
    },
  };

  callbacks.setElements((prev) => [...prev, newElement]);

  return {
    type: "element_created",
    correlationId,
    timestamp,
    success: true,
    data: { elementId: id },
  };
}

function handleUpdateElement(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const elementId = request.elementId as string;
  const updates = request.updates as Record<string, unknown>;

  const elements = callbacks.getElements();
  const element = elements.find((e) => e.id === elementId);

  if (!element) {
    return {
      type: "error",
      correlationId,
      timestamp,
      success: false,
      error: {
        code: "ELEMENT_NOT_FOUND",
        message: `Element ${elementId} not found`,
      },
    };
  }

  // Validate coordinate updates before recording snapshot
  if (typeof updates.x === "number" || typeof updates.y === "number") {
    const x = typeof updates.x === "number" ? updates.x : element.x;
    const y = typeof updates.y === "number" ? updates.y : element.y;
    const coordValidation = validateCoordinates(x, y);
    if (!coordValidation.valid) {
      return { type: "error", correlationId, timestamp, success: false, error: coordValidation.error };
    }
  }

  if (typeof updates.width === "number" || typeof updates.height === "number") {
    const width = typeof updates.width === "number" ? updates.width : element.width;
    const height = typeof updates.height === "number" ? updates.height : element.height;
    const dimValidation = validateDimensions(width, height);
    if (!dimValidation.valid) {
      return { type: "error", correlationId, timestamp, success: false, error: dimValidation.error };
    }
  }

  callbacks.recordSnapshot();

  callbacks.setElements((prev) =>
    prev.map((el) => {
      if (el.id !== elementId) return el;

      const updated = { ...el };

      // Apply position updates (with clamping)
      if (typeof updates.x === "number") updated.x = clampToCanvas(updates.x);
      if (typeof updates.y === "number") updated.y = clampToCanvas(updates.y);
      if (typeof updates.width === "number") updated.width = updates.width;
      if (typeof updates.height === "number") updated.height = updates.height;

      // Apply style updates
      if (updates.strokeColor || updates.fillColor) {
        const currentStyle = updated.style || { strokeColor: DEFAULT_STROKE_COLOR, fillColor: DEFAULT_FILL_COLOR };
        updated.style = {
          strokeColor: typeof updates.strokeColor === "string" ? updates.strokeColor : currentStyle.strokeColor,
          fillColor: typeof updates.fillColor === "string" ? updates.fillColor : currentStyle.fillColor,
        };
      }

      // Apply text-specific updates
      if (el.type === "text") {
        if (typeof updates.content === "string")
          (updated as any).content = updates.content;
        if (typeof updates.fontSize === "number")
          (updated as any).fontSize = updates.fontSize;
        if (updates.textAlign)
          (updated as any).textAlign = updates.textAlign;
      }

      // Apply arrow/line-specific updates
      if (el.type === "arrow" || el.type === "line") {
        if (typeof updates.startX === "number")
          (updated as any).startX = updates.startX;
        if (typeof updates.startY === "number")
          (updated as any).startY = updates.startY;
        if (typeof updates.endX === "number")
          (updated as any).endX = updates.endX;
        if (typeof updates.endY === "number")
          (updated as any).endY = updates.endY;
      }

      return updated;
    })
  );

  return {
    type: "element_updated",
    correlationId,
    timestamp,
    success: true,
    data: { elementId },
  };
}

function handleDeleteElements(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const elementIds = request.elementIds as string[];

  callbacks.recordSnapshot();

  const idsSet = new Set(elementIds);
  let deletedCount = 0;

  callbacks.setElements((prev) => {
    const filtered = prev.filter((el) => {
      if (idsSet.has(el.id)) {
        deletedCount++;
        return false;
      }
      return true;
    });
    return filtered;
  });

  // Clear selection for deleted elements
  const currentSelection = callbacks.getSelectedElementIds();
  const newSelection = currentSelection.filter((id) => !idsSet.has(id));
  callbacks.setSelectedElementIds(new Set(newSelection));

  return {
    type: "elements_deleted",
    correlationId,
    timestamp,
    success: true,
    data: { deletedCount },
  };
}

function handleDeleteSelected(
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const selectedIds = callbacks.getSelectedElementIds();

  if (selectedIds.length === 0) {
    return {
      type: "elements_deleted",
      correlationId,
      timestamp,
      success: true,
      data: { deletedCount: 0 },
    };
  }

  callbacks.recordSnapshot();

  const idsSet = new Set(selectedIds);
  let deletedCount = 0;

  callbacks.setElements((prev) => {
    const filtered = prev.filter((el) => {
      if (idsSet.has(el.id)) {
        deletedCount++;
        return false;
      }
      return true;
    });
    return filtered;
  });

  callbacks.setSelectedElementIds(new Set());
  callbacks.setSelectedElementId(null);

  return {
    type: "elements_deleted",
    correlationId,
    timestamp,
    success: true,
    data: { deletedCount },
  };
}

function handleSelectElements(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const elementIds = request.elementIds as string[];

  callbacks.setSelectedElementIds(new Set(elementIds));
  callbacks.setSelectedElementId(elementIds.length === 1 ? elementIds[0] : null);

  return {
    type: "selection_set",
    correlationId,
    timestamp,
    success: true,
    data: { selectedIds: elementIds },
  };
}

function handleClearSelection(
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  callbacks.setSelectedElementIds(new Set());
  callbacks.setSelectedElementId(null);

  return {
    type: "selection_set",
    correlationId,
    timestamp,
    success: true,
    data: { selectedIds: [] },
  };
}

function handleListComponents(
  correlationId: string,
  timestamp: string
): MCPResponse {
  const templates = COMPONENT_TEMPLATES.map((t) => ({
    type: t.type,
    name: t.name,
    description: t.description,
  }));

  return {
    type: "components_list",
    correlationId,
    timestamp,
    success: true,
    data: { templates },
  };
}

function handleCreateComponent(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const templateType = request.templateType as string;
  const x = request.x as number;
  const y = request.y as number;

  const result = callbacks.createComponentGroup(templateType, x, y);

  if (!result) {
    return {
      type: "error",
      correlationId,
      timestamp,
      success: false,
      error: {
        code: "COMPONENT_NOT_FOUND",
        message: `Component template "${templateType}" not found`,
      },
    };
  }

  return {
    type: "component_created",
    correlationId,
    timestamp,
    success: true,
    data: result,
  };
}

function handleListFrames(
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const state = callbacks.getState();

  return {
    type: "frames",
    correlationId,
    timestamp,
    success: true,
    data: {
      frames: state.frames.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        elementCount: f.elements.length,
      })),
    },
  };
}

function handleSwitchFrame(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const frameId = request.frameId as string;

  const state = callbacks.getState();
  const frame = state.frames.find((f) => f.id === frameId);

  if (!frame) {
    return {
      type: "error",
      correlationId,
      timestamp,
      success: false,
      error: {
        code: "FRAME_NOT_FOUND",
        message: `Frame ${frameId} not found`,
      },
    };
  }

  callbacks.setActiveFrameId(frameId);

  return {
    type: "frame_switched",
    correlationId,
    timestamp,
    success: true,
    data: { frameId },
  };
}

function handleCreateFrame(
  request: MCPRequest,
  correlationId: string,
  timestamp: string,
  callbacks: MCPBridgeCallbacks
): MCPResponse {
  const name = request.name as string;
  const frameType = (request.frameType as FrameType) || "page";

  const frameId = callbacks.addFrame(name, frameType);

  return {
    type: "frame_created",
    correlationId,
    timestamp,
    success: true,
    data: { frameId },
  };
}

// ============================================================
// Helpers
// ============================================================

function serializeElement(element: CanvasElement): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    style: element.style,
    semanticTag: element.semanticTag,
    description: element.description,
  };

  if (element.type === "text") {
    base.content = (element as any).content;
    base.fontSize = (element as any).fontSize;
    base.textAlign = (element as any).textAlign;
  }

  if (element.type === "arrow" || element.type === "line") {
    base.startX = (element as any).startX;
    base.startY = (element as any).startY;
    base.endX = (element as any).endX;
    base.endY = (element as any).endY;
  }

  return base;
}

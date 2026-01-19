/**
 * WebSocket Protocol Types for MCP Server <-> WireFlow Communication
 */

// ============================================================
// Base Types
// ============================================================

export type CorrelationId = string;
export type Timestamp = string;

export interface BaseMessage {
  type: string;
  timestamp: Timestamp;
}

export interface BaseRequest extends BaseMessage {
  correlationId: CorrelationId;
}

export interface BaseResponse extends BaseMessage {
  correlationId: CorrelationId;
  success: boolean;
}

export interface BaseEvent extends BaseMessage {}

// ============================================================
// Canvas Element Types (matching WireFlow lib/types.ts)
// ============================================================

export type CanvasElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "text"
  | "arrow"
  | "line"
  | "freedraw";

export type SemanticTag =
  | "button"
  | "input"
  | "section"
  | "heading"
  | "nav"
  | "link"
  | "listitem"
  | "dialog"
  | "table"
  | null;

export interface ElementStyle {
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}

export interface CanvasElementData {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: ElementStyle;
  semanticTag?: SemanticTag;
  description?: string;
  // Text-specific
  content?: string;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  // Arrow/Line-specific
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Freedraw-specific
  points?: Array<{ x: number; y: number }>;
}

export interface FrameData {
  id: string;
  name: string;
  type: "page" | "modal" | "flyout";
  elementCount: number;
}

// ============================================================
// Request Messages (MCP Server -> WireFlow)
// ============================================================

export interface PingRequest extends BaseRequest {
  type: "ping";
}

export interface GetStateRequest extends BaseRequest {
  type: "get_state";
}

export interface GetElementsRequest extends BaseRequest {
  type: "get_elements";
  frameId?: string;
}

export interface GetElementRequest extends BaseRequest {
  type: "get_element";
  elementId: string;
}

export interface GetFramesRequest extends BaseRequest {
  type: "get_frames";
}

export interface GetSelectionRequest extends BaseRequest {
  type: "get_selection";
}

// Element creation base
export interface CreateElementBase {
  x: number;
  y: number;
  strokeColor?: string;
  fillColor?: string;
  frameId?: string;
}

export interface CreateRectangleRequest extends BaseRequest {
  type: "create_rectangle";
  params: CreateElementBase & {
    width: number;
    height: number;
  };
}

export interface CreateEllipseRequest extends BaseRequest {
  type: "create_ellipse";
  params: CreateElementBase & {
    width: number;
    height: number;
  };
}

export interface CreateTextRequest extends BaseRequest {
  type: "create_text";
  params: CreateElementBase & {
    content: string;
    fontSize?: number;
    textAlign?: "left" | "center" | "right";
  };
}

export interface CreateArrowRequest extends BaseRequest {
  type: "create_arrow";
  params: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string;
    frameId?: string;
  };
}

export interface CreateLineRequest extends BaseRequest {
  type: "create_line";
  params: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor?: string;
    frameId?: string;
  };
}

export interface UpdateElementRequest extends BaseRequest {
  type: "update_element";
  elementId: string;
  updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor: string;
    fillColor: string;
    content: string;
    fontSize: number;
    textAlign: "left" | "center" | "right";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    semanticTag: SemanticTag;
    description: string;
  }>;
}

export interface DeleteElementsRequest extends BaseRequest {
  type: "delete_elements";
  elementIds: string[];
}

export interface DeleteSelectedRequest extends BaseRequest {
  type: "delete_selected";
}

export interface SelectElementsRequest extends BaseRequest {
  type: "select_elements";
  elementIds: string[];
}

export interface ClearSelectionRequest extends BaseRequest {
  type: "clear_selection";
}

export interface CreateComponentRequest extends BaseRequest {
  type: "create_component";
  templateType: string;
  x: number;
  y: number;
  frameId?: string;
}

export interface ListComponentsRequest extends BaseRequest {
  type: "list_components";
}

export interface ListFramesRequest extends BaseRequest {
  type: "list_frames";
}

export interface SwitchFrameRequest extends BaseRequest {
  type: "switch_frame";
  frameId: string;
}

export interface CreateFrameRequest extends BaseRequest {
  type: "create_frame";
  name: string;
  frameType?: "page" | "modal" | "flyout";
}

export type WireFlowRequest =
  | PingRequest
  | GetStateRequest
  | GetElementsRequest
  | GetElementRequest
  | GetFramesRequest
  | GetSelectionRequest
  | CreateRectangleRequest
  | CreateEllipseRequest
  | CreateTextRequest
  | CreateArrowRequest
  | CreateLineRequest
  | UpdateElementRequest
  | DeleteElementsRequest
  | DeleteSelectedRequest
  | SelectElementsRequest
  | ClearSelectionRequest
  | CreateComponentRequest
  | ListComponentsRequest
  | ListFramesRequest
  | SwitchFrameRequest
  | CreateFrameRequest;

// ============================================================
// Response Messages (WireFlow -> MCP Server)
// ============================================================

export interface PongResponse extends BaseResponse {
  type: "pong";
  success: true;
}

export interface StateResponse extends BaseResponse {
  type: "state";
  success: true;
  data: {
    activeFrameId: string;
    frames: FrameData[];
    elementCount: number;
    selectedElementIds: string[];
    canUndo: boolean;
    canRedo: boolean;
  };
}

export interface ElementsResponse extends BaseResponse {
  type: "elements";
  success: true;
  data: {
    elements: CanvasElementData[];
  };
}

export interface ElementResponse extends BaseResponse {
  type: "element";
  success: true;
  data: {
    element: CanvasElementData;
  };
}

export interface FramesResponse extends BaseResponse {
  type: "frames";
  success: true;
  data: {
    frames: FrameData[];
  };
}

export interface SelectionResponse extends BaseResponse {
  type: "selection";
  success: true;
  data: {
    selectedIds: string[];
  };
}

export interface ElementCreatedResponse extends BaseResponse {
  type: "element_created";
  success: true;
  data: {
    elementId: string;
  };
}

export interface ElementUpdatedResponse extends BaseResponse {
  type: "element_updated";
  success: true;
  data: {
    elementId: string;
  };
}

export interface ElementsDeletedResponse extends BaseResponse {
  type: "elements_deleted";
  success: true;
  data: {
    deletedCount: number;
  };
}

export interface SelectionSetResponse extends BaseResponse {
  type: "selection_set";
  success: true;
  data: {
    selectedIds: string[];
  };
}

export interface ComponentCreatedResponse extends BaseResponse {
  type: "component_created";
  success: true;
  data: {
    elementIds: string[];
    groupId: string;
  };
}

export interface ComponentsListResponse extends BaseResponse {
  type: "components_list";
  success: true;
  data: {
    templates: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  };
}

export interface FrameCreatedResponse extends BaseResponse {
  type: "frame_created";
  success: true;
  data: {
    frameId: string;
  };
}

export interface FrameSwitchedResponse extends BaseResponse {
  type: "frame_switched";
  success: true;
  data: {
    frameId: string;
  };
}

export type ErrorCode =
  | "INVALID_REQUEST"
  | "UNKNOWN_TYPE"
  | "ELEMENT_NOT_FOUND"
  | "FRAME_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CANNOT_DELETE_LAST_FRAME"
  | "COMPONENT_NOT_FOUND"
  | "NOT_CONNECTED"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

export interface ErrorResponse extends BaseResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type WireFlowResponse =
  | PongResponse
  | StateResponse
  | ElementsResponse
  | ElementResponse
  | FramesResponse
  | SelectionResponse
  | ElementCreatedResponse
  | ElementUpdatedResponse
  | ElementsDeletedResponse
  | SelectionSetResponse
  | ComponentCreatedResponse
  | ComponentsListResponse
  | FrameCreatedResponse
  | FrameSwitchedResponse
  | ErrorResponse;

// ============================================================
// Event Messages (WireFlow -> MCP Server, unsolicited)
// ============================================================

export interface ClientConnectedEvent extends BaseEvent {
  type: "client_connected";
  data: {
    clientInfo: {
      userAgent: string;
      url: string;
    };
  };
}

export interface ClientDisconnectedEvent extends BaseEvent {
  type: "client_disconnected";
  data: {
    reason: "close" | "error" | "timeout";
  };
}

export interface StateChangedEvent extends BaseEvent {
  type: "state_changed";
  data: {
    changeType: string;
    affectedIds?: string[];
  };
}

export type WireFlowEvent =
  | ClientConnectedEvent
  | ClientDisconnectedEvent
  | StateChangedEvent;

// ============================================================
// Utility Functions
// ============================================================

export function generateCorrelationId(): CorrelationId {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

export function generateTimestamp(): Timestamp {
  return new Date().toISOString();
}

export function isErrorResponse(response: WireFlowResponse): response is ErrorResponse {
  return response.success === false;
}

export function isEvent(message: unknown): message is WireFlowEvent {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    !("correlationId" in message) &&
    !("success" in message)
  );
}

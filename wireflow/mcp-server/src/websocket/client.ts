/**
 * WebSocket Client for MCP Server
 * Manages connection to WireFlow browser app and message handling
 */

import WebSocket, { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import {
  WireFlowEvent,
  generateCorrelationId,
  generateTimestamp,
  isEvent,
} from "./protocol.js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

// Generic response type for the websocket client
export interface WSResponse {
  type: string;
  correlationId: string;
  timestamp: string;
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface PendingRequest {
  resolve: (response: WSResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface WebSocketClientConfig {
  port: number;
  requestTimeout: number;
  pingInterval: number;
}

const DEFAULT_CONFIG: WebSocketClientConfig = {
  port: 3001,
  requestTimeout: 10000,
  pingInterval: 15000,
};

export class WebSocketClient {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private config: WebSocketClientConfig;
  private pingInterval: NodeJS.Timeout | null = null;
  private _status: ConnectionStatus = "disconnected";
  private eventHandlers: ((event: WireFlowEvent) => void)[] = [];

  constructor(config: Partial<WebSocketClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get isConnected(): boolean {
    return this._status === "connected" && this.client?.readyState === WebSocket.OPEN;
  }

  /**
   * Start WebSocket server and wait for WireFlow to connect
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.config.port });

        this.wss.on("listening", () => {
          console.error(`[WS] Server listening on port ${this.config.port}`);
          resolve();
        });

        this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
          this.handleConnection(ws, req);
        });

        this.wss.on("error", (error: Error) => {
          console.error("[WS] Server error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Server shutting down"));
      }
      this.pendingRequests.clear();

      if (this.client) {
        this.client.close(1000, "Server shutting down");
        this.client = null;
      }

      if (this.wss) {
        this.wss.close(() => {
          this.wss = null;
          this._status = "disconnected";
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a command to WireFlow and wait for response
   */
  async sendCommand(request: Record<string, unknown>): Promise<WSResponse> {
    if (!this.isConnected) {
      return {
        type: "error",
        correlationId: "",
        timestamp: generateTimestamp(),
        success: false,
        error: {
          code: "NOT_CONNECTED",
          message: "WireFlow is not connected. Please open the app in a browser.",
        },
      };
    }

    const correlationId = generateCorrelationId();
    const fullRequest = {
      ...request,
      correlationId,
      timestamp: generateTimestamp(),
    };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        resolve({
          type: "error",
          correlationId,
          timestamp: generateTimestamp(),
          success: false,
          error: {
            code: "TIMEOUT",
            message: `Request timed out after ${this.config.requestTimeout}ms`,
          },
        });
      }, this.config.requestTimeout);

      this.pendingRequests.set(correlationId, {
        resolve,
        reject: () => {},
        timeout,
      });

      try {
        this.client!.send(JSON.stringify(fullRequest));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(correlationId);
        resolve({
          type: "error",
          correlationId,
          timestamp: generateTimestamp(),
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        });
      }
    });
  }

  /**
   * Register an event handler
   */
  onEvent(handler: (event: WireFlowEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index !== -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Only allow one client at a time
    if (this.client) {
      console.error("[WS] New client attempted to connect, rejecting (already have a client)");
      ws.close(1008, "Only one client allowed");
      return;
    }

    console.error("[WS] Client connected from:", req.socket.remoteAddress);
    this.client = ws;
    this._status = "connected";

    // Start ping interval
    this.startPingInterval();

    ws.on("message", (data: Buffer) => {
      this.handleMessage(data.toString());
    });

    ws.on("close", (code: number, reason: Buffer) => {
      console.error(`[WS] Client disconnected: ${code} ${reason.toString()}`);
      this.handleDisconnect();
    });

    ws.on("error", (error: Error) => {
      console.error("[WS] Client error:", error);
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WSResponse;

      // Check if it's an event (no correlationId)
      if (isEvent(message)) {
        this.handleEvent(message as unknown as WireFlowEvent);
        return;
      }

      // It's a response
      const pending = this.pendingRequests.get(message.correlationId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.correlationId);
        pending.resolve(message);
      } else {
        console.error(`[WS] Received response for unknown request: ${message.correlationId}`);
      }
    } catch (error) {
      console.error("[WS] Failed to parse message:", error);
    }
  }

  private handleEvent(event: WireFlowEvent): void {
    console.error(`[WS] Received event: ${event.type}`);
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("[WS] Event handler error:", error);
      }
    }
  }

  private handleDisconnect(): void {
    this.client = null;
    this._status = "disconnected";

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Fail all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.resolve({
        type: "error",
        correlationId: id,
        timestamp: generateTimestamp(),
        success: false,
        error: {
          code: "NOT_CONNECTED",
          message: "Client disconnected",
        },
      });
    }
    this.pendingRequests.clear();
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.client?.readyState === WebSocket.OPEN) {
        this.client.ping();
      }
    }, this.config.pingInterval);
  }
}

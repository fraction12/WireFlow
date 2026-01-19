/**
 * WebSocket Client for MCP Server
 * Manages connection to WireFlow browser app and message handling
 */
import { WireFlowEvent } from "./protocol.js";
export type ConnectionStatus = "disconnected" | "connecting" | "connected";
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
export interface WebSocketClientConfig {
    port: number;
    requestTimeout: number;
    pingInterval: number;
}
export declare class WebSocketClient {
    private wss;
    private client;
    private pendingRequests;
    private config;
    private pingInterval;
    private _status;
    private eventHandlers;
    constructor(config?: Partial<WebSocketClientConfig>);
    get status(): ConnectionStatus;
    get isConnected(): boolean;
    /**
     * Start WebSocket server and wait for WireFlow to connect
     */
    start(): Promise<void>;
    /**
     * Stop the WebSocket server
     */
    stop(): Promise<void>;
    /**
     * Send a command to WireFlow and wait for response
     */
    sendCommand(request: Record<string, unknown>): Promise<WSResponse>;
    /**
     * Register an event handler
     */
    onEvent(handler: (event: WireFlowEvent) => void): () => void;
    private handleConnection;
    private handleMessage;
    private handleEvent;
    private handleDisconnect;
    private startPingInterval;
}
//# sourceMappingURL=client.d.ts.map
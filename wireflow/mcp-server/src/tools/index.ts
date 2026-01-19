/**
 * Tool Registry - Exports all tools for MCP server registration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import { registerCanvasStateTools } from "./canvasState.js";
import { registerCreateElementTools } from "./createElement.js";
import { registerUpdateElementTools } from "./updateElement.js";
import { registerDeleteElementTools } from "./deleteElement.js";
import { registerSelectionTools } from "./selection.js";
import { registerComponentTools } from "./components.js";
import { registerFrameTools } from "./frames.js";

/**
 * Register all WireFlow MCP tools with the server
 */
export function registerAllTools(server: McpServer, wsClient: WebSocketClient): void {
  // State query tools
  registerCanvasStateTools(server, wsClient);

  // Element creation tools
  registerCreateElementTools(server, wsClient);

  // Element modification tools
  registerUpdateElementTools(server, wsClient);

  // Element deletion tools
  registerDeleteElementTools(server, wsClient);

  // Selection tools
  registerSelectionTools(server, wsClient);

  // Component tools
  registerComponentTools(server, wsClient);

  // Frame tools
  registerFrameTools(server, wsClient);

  console.error("[MCP] Registered all WireFlow tools");
}

// Re-export individual registrations for testing
export {
  registerCanvasStateTools,
  registerCreateElementTools,
  registerUpdateElementTools,
  registerDeleteElementTools,
  registerSelectionTools,
  registerComponentTools,
  registerFrameTools,
};

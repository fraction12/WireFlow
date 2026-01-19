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
export declare function registerAllTools(server: McpServer, wsClient: WebSocketClient): void;
export { registerCanvasStateTools, registerCreateElementTools, registerUpdateElementTools, registerDeleteElementTools, registerSelectionTools, registerComponentTools, registerFrameTools, };
//# sourceMappingURL=index.d.ts.map
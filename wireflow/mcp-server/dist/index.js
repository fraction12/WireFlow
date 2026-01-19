/**
 * WireFlow MCP Server
 *
 * Entry point for the MCP server that bridges Claude Code to WireFlow
 * via WebSocket communication.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketClient } from "./websocket/client.js";
import { registerAllTools } from "./tools/index.js";
// Configuration from environment
const WS_PORT = parseInt(process.env.WIREFLOW_WS_PORT || "3001", 10);
async function main() {
    console.error("[MCP] Starting WireFlow MCP Server...");
    // Create WebSocket client for communicating with WireFlow
    const wsClient = new WebSocketClient({
        port: WS_PORT,
        requestTimeout: 10000,
        pingInterval: 15000,
    });
    // Create MCP server
    const server = new McpServer({
        name: "wireflow",
        version: "1.0.0",
    });
    // Register all tools
    registerAllTools(server, wsClient);
    // Start WebSocket server
    try {
        await wsClient.start();
        console.error(`[MCP] WebSocket server started on port ${WS_PORT}`);
        console.error("[MCP] Waiting for WireFlow to connect...");
    }
    catch (error) {
        console.error("[MCP] Failed to start WebSocket server:", error);
        process.exit(1);
    }
    // Listen for WebSocket events
    wsClient.onEvent((event) => {
        if (event.type === "client_connected") {
            console.error("[MCP] WireFlow connected!");
        }
        else if (event.type === "client_disconnected") {
            console.error("[MCP] WireFlow disconnected:", event.data.reason);
        }
        else if (event.type === "state_changed") {
            console.error(`[MCP] State changed: ${event.data.changeType}`);
        }
    });
    // Create stdio transport for Claude Code communication
    const transport = new StdioServerTransport();
    // Connect server to transport
    await server.connect(transport);
    console.error("[MCP] MCP Server ready and listening on stdio");
    // Handle shutdown
    process.on("SIGINT", async () => {
        console.error("[MCP] Shutting down...");
        await wsClient.stop();
        process.exit(0);
    });
    process.on("SIGTERM", async () => {
        console.error("[MCP] Shutting down...");
        await wsClient.stop();
        process.exit(0);
    });
}
main().catch((error) => {
    console.error("[MCP] Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
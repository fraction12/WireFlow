/**
 * Update Element Tool - Modify existing elements
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import { updateElementSchema, UpdateElementInput } from "./types.js";

export function registerUpdateElementTools(server: McpServer, wsClient: WebSocketClient): void {
  // update_element
  server.tool(
    "update_element",
    "Update an existing element's properties (position, size, colors, text content)",
    updateElementSchema.shape,
    async (params: UpdateElementInput) => {
      const { elementId, ...updates } = params;

      // Filter out undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );

      if (Object.keys(cleanUpdates).length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: No updates provided",
            },
          ],
        };
      }

      const response = await wsClient.sendCommand({
        type: "update_element",
        elementId,
        updates: cleanUpdates,
      });

      if (!response.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${response.error?.message || "Unknown error"}`,
            },
          ],
        };
      }

      const data = response.data as { elementId: string };
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated element ${data.elementId}`,
          },
        ],
      };
    }
  );
}

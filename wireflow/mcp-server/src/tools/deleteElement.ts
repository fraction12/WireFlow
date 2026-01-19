/**
 * Delete Element Tools - Delete elements from canvas
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import { deleteElementsSchema, DeleteElementsInput } from "./types.js";

export function registerDeleteElementTools(server: McpServer, wsClient: WebSocketClient): void {
  // delete_elements
  server.tool(
    "delete_elements",
    "Delete one or more elements by their IDs",
    deleteElementsSchema.shape,
    async (params: DeleteElementsInput) => {
      const response = await wsClient.sendCommand({
        type: "delete_elements",
        elementIds: params.elementIds,
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

      const data = response.data as { deletedCount: number };
      return {
        content: [
          {
            type: "text" as const,
            text: `Deleted ${data.deletedCount} element(s)`,
          },
        ],
      };
    }
  );

  // delete_selected
  server.tool(
    "delete_selected",
    "Delete all currently selected elements",
    {},
    async () => {
      const response = await wsClient.sendCommand({
        type: "delete_selected",
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

      const data = response.data as { deletedCount: number };
      return {
        content: [
          {
            type: "text" as const,
            text: `Deleted ${data.deletedCount} selected element(s)`,
          },
        ],
      };
    }
  );
}

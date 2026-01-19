/**
 * Selection Tools - Select and deselect elements
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import { selectElementsSchema, SelectElementsInput } from "./types.js";

export function registerSelectionTools(server: McpServer, wsClient: WebSocketClient): void {
  // select_elements
  server.tool(
    "select_elements",
    "Select one or more elements by their IDs",
    selectElementsSchema.shape,
    async (params: SelectElementsInput) => {
      const response = await wsClient.sendCommand({
        type: "select_elements",
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

      const data = response.data as { selectedIds: string[] };
      return {
        content: [
          {
            type: "text" as const,
            text: `Selected ${data.selectedIds?.length || 0} element(s)`,
          },
        ],
      };
    }
  );

  // clear_selection
  server.tool(
    "clear_selection",
    "Clear the current selection (deselect all elements)",
    {},
    async () => {
      const response = await wsClient.sendCommand({
        type: "clear_selection",
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

      return {
        content: [
          {
            type: "text" as const,
            text: "Selection cleared",
          },
        ],
      };
    }
  );
}

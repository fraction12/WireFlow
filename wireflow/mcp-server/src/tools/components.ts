/**
 * Component Tools - Create components and list available templates
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import { createComponentSchema, CreateComponentInput } from "./types.js";

export function registerComponentTools(server: McpServer, wsClient: WebSocketClient): void {
  // create_component
  server.tool(
    "create_component",
    "Create a component from a template (e.g., button, card, text-input, dropdown, modal-dialog)",
    createComponentSchema.shape,
    async (params: CreateComponentInput) => {
      const response = await wsClient.sendCommand({
        type: "create_component",
        templateType: params.templateType,
        x: params.x,
        y: params.y,
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

      const data = response.data as { elementIds: string[]; groupId: string };
      return {
        content: [
          {
            type: "text" as const,
            text: `Created component with ${data.elementIds?.length || 0} elements. Group ID: ${data.groupId}`,
          },
        ],
      };
    }
  );

  // list_components
  server.tool(
    "list_components",
    "List all available component templates",
    {},
    async () => {
      const response = await wsClient.sendCommand({
        type: "list_components",
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

      const data = response.data as {
        templates: Array<{ type: string; name: string; description: string }>;
      };
      const templateList = data.templates
        ?.map((t) => `- ${t.type}: ${t.name} - ${t.description}`)
        .join("\n") || "No templates available";

      return {
        content: [
          {
            type: "text" as const,
            text: `Available component templates:\n${templateList}`,
          },
        ],
      };
    }
  );
}

/**
 * Frame Tools - Manage frames/pages
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import {
  switchFrameSchema,
  createFrameSchema,
  SwitchFrameInput,
  CreateFrameInput,
} from "./types.js";

export function registerFrameTools(server: McpServer, wsClient: WebSocketClient): void {
  // list_frames
  server.tool(
    "list_frames",
    "List all frames (pages) in the workspace",
    {},
    async () => {
      const response = await wsClient.sendCommand({
        type: "list_frames",
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
        frames: Array<{ id: string; name: string; type: string; elementCount: number }>;
      };
      const frameList = data.frames
        ?.map((f) => `- ${f.id}: "${f.name}" (${f.type}, ${f.elementCount} elements)`)
        .join("\n") || "No frames";

      return {
        content: [
          {
            type: "text" as const,
            text: `Frames:\n${frameList}`,
          },
        ],
      };
    }
  );

  // switch_frame
  server.tool(
    "switch_frame",
    "Switch to a different frame by ID",
    switchFrameSchema.shape,
    async (params: SwitchFrameInput) => {
      const response = await wsClient.sendCommand({
        type: "switch_frame",
        frameId: params.frameId,
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

      const data = response.data as { frameId: string };
      return {
        content: [
          {
            type: "text" as const,
            text: `Switched to frame: ${data.frameId}`,
          },
        ],
      };
    }
  );

  // create_frame
  server.tool(
    "create_frame",
    "Create a new frame (page, modal, or flyout)",
    createFrameSchema.shape,
    async (params: CreateFrameInput) => {
      const response = await wsClient.sendCommand({
        type: "create_frame",
        name: params.name,
        frameType: params.frameType,
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

      const data = response.data as { frameId: string };
      return {
        content: [
          {
            type: "text" as const,
            text: `Created frame with ID: ${data.frameId}`,
          },
        ],
      };
    }
  );
}

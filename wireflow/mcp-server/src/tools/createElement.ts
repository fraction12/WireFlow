/**
 * Create Element Tools - Create rectangles, ellipses, text, arrows, and lines
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebSocketClient } from "../websocket/client.js";
import {
  createRectangleSchema,
  createEllipseSchema,
  createTextSchema,
  createArrowSchema,
  createLineSchema,
  CreateRectangleInput,
  CreateEllipseInput,
  CreateTextInput,
  CreateArrowInput,
  CreateLineInput,
} from "./types.js";

export function registerCreateElementTools(server: McpServer, wsClient: WebSocketClient): void {
  // create_rectangle
  server.tool(
    "create_rectangle",
    "Create a rectangle element on the canvas",
    createRectangleSchema.shape,
    async (params: CreateRectangleInput) => {
      const response = await wsClient.sendCommand({
        type: "create_rectangle",
        params: {
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
          strokeColor: params.strokeColor,
          fillColor: params.fillColor,
        },
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
            text: `Created rectangle with ID: ${data.elementId}`,
          },
        ],
      };
    }
  );

  // create_ellipse
  server.tool(
    "create_ellipse",
    "Create an ellipse (oval) element on the canvas",
    createEllipseSchema.shape,
    async (params: CreateEllipseInput) => {
      const response = await wsClient.sendCommand({
        type: "create_ellipse",
        params: {
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
          strokeColor: params.strokeColor,
          fillColor: params.fillColor,
        },
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
            text: `Created ellipse with ID: ${data.elementId}`,
          },
        ],
      };
    }
  );

  // create_text
  server.tool(
    "create_text",
    "Create a text element on the canvas",
    createTextSchema.shape,
    async (params: CreateTextInput) => {
      const response = await wsClient.sendCommand({
        type: "create_text",
        params: {
          x: params.x,
          y: params.y,
          content: params.content,
          fontSize: params.fontSize,
          textAlign: params.textAlign,
        },
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
            text: `Created text with ID: ${data.elementId}`,
          },
        ],
      };
    }
  );

  // create_arrow
  server.tool(
    "create_arrow",
    "Create an arrow element on the canvas",
    createArrowSchema.shape,
    async (params: CreateArrowInput) => {
      const response = await wsClient.sendCommand({
        type: "create_arrow",
        params: {
          startX: params.startX,
          startY: params.startY,
          endX: params.endX,
          endY: params.endY,
          strokeColor: params.strokeColor,
        },
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
            text: `Created arrow with ID: ${data.elementId}`,
          },
        ],
      };
    }
  );

  // create_line
  server.tool(
    "create_line",
    "Create a line element on the canvas",
    createLineSchema.shape,
    async (params: CreateLineInput) => {
      const response = await wsClient.sendCommand({
        type: "create_line",
        params: {
          startX: params.startX,
          startY: params.startY,
          endX: params.endX,
          endY: params.endY,
          strokeColor: params.strokeColor,
        },
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
            text: `Created line with ID: ${data.elementId}`,
          },
        ],
      };
    }
  );
}

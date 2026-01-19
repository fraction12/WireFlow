/**
 * Canvas State Tools - Read canvas state, elements, and selection
 */
import { getElementsSchema } from "./types.js";
export function registerCanvasStateTools(server, wsClient) {
    // get_canvas_state - Get overview of canvas state
    server.tool("get_canvas_state", "Get the current canvas state including active frame, element count, and selection", {}, async () => {
        const response = await wsClient.sendCommand({
            type: "get_state",
        });
        if (!response.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${response.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response.data, null, 2),
                },
            ],
        };
    });
    // get_elements - Get all elements in a frame
    server.tool("get_elements", "Get all elements in the current or specified frame", getElementsSchema.shape, async (params) => {
        const response = await wsClient.sendCommand({
            type: "get_elements",
            frameId: params.frameId,
        });
        if (!response.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${response.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }
        const data = response.data;
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        count: data.elements?.length || 0,
                        elements: data.elements,
                    }, null, 2),
                },
            ],
        };
    });
    // get_selection - Get currently selected element IDs
    server.tool("get_selection", "Get the IDs of currently selected elements", {}, async () => {
        const response = await wsClient.sendCommand({
            type: "get_selection",
        });
        if (!response.success) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${response.error?.message || "Unknown error"}`,
                    },
                ],
            };
        }
        const data = response.data;
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        selectedIds: data.selectedIds,
                        count: data.selectedIds?.length || 0,
                    }, null, 2),
                },
            ],
        };
    });
}
//# sourceMappingURL=canvasState.js.map
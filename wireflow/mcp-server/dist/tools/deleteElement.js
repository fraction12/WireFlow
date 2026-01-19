/**
 * Delete Element Tools - Delete elements from canvas
 */
import { deleteElementsSchema } from "./types.js";
export function registerDeleteElementTools(server, wsClient) {
    // delete_elements
    server.tool("delete_elements", "Delete one or more elements by their IDs", deleteElementsSchema.shape, async (params) => {
        const response = await wsClient.sendCommand({
            type: "delete_elements",
            elementIds: params.elementIds,
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
                    text: `Deleted ${data.deletedCount} element(s)`,
                },
            ],
        };
    });
    // delete_selected
    server.tool("delete_selected", "Delete all currently selected elements", {}, async () => {
        const response = await wsClient.sendCommand({
            type: "delete_selected",
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
                    text: `Deleted ${data.deletedCount} selected element(s)`,
                },
            ],
        };
    });
}
//# sourceMappingURL=deleteElement.js.map
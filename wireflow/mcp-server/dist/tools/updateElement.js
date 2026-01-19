/**
 * Update Element Tool - Modify existing elements
 */
import { updateElementSchema } from "./types.js";
export function registerUpdateElementTools(server, wsClient) {
    // update_element
    server.tool("update_element", "Update an existing element's properties (position, size, colors, text content)", updateElementSchema.shape, async (params) => {
        const { elementId, ...updates } = params;
        // Filter out undefined values
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
        if (Object.keys(cleanUpdates).length === 0) {
            return {
                content: [
                    {
                        type: "text",
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
                    text: `Updated element ${data.elementId}`,
                },
            ],
        };
    });
}
//# sourceMappingURL=updateElement.js.map
/**
 * Selection Tools - Select and deselect elements
 */
import { selectElementsSchema } from "./types.js";
export function registerSelectionTools(server, wsClient) {
    // select_elements
    server.tool("select_elements", "Select one or more elements by their IDs", selectElementsSchema.shape, async (params) => {
        const response = await wsClient.sendCommand({
            type: "select_elements",
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
                    text: `Selected ${data.selectedIds?.length || 0} element(s)`,
                },
            ],
        };
    });
    // clear_selection
    server.tool("clear_selection", "Clear the current selection (deselect all elements)", {}, async () => {
        const response = await wsClient.sendCommand({
            type: "clear_selection",
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
                    text: "Selection cleared",
                },
            ],
        };
    });
}
//# sourceMappingURL=selection.js.map
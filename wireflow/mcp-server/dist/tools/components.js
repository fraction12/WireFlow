/**
 * Component Tools - Create components and list available templates
 */
import { createComponentSchema } from "./types.js";
export function registerComponentTools(server, wsClient) {
    // create_component
    server.tool("create_component", "Create a component from a template (e.g., button, card, text-input, dropdown, modal-dialog)", createComponentSchema.shape, async (params) => {
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
                    text: `Created component with ${data.elementIds?.length || 0} elements. Group ID: ${data.groupId}`,
                },
            ],
        };
    });
    // list_components
    server.tool("list_components", "List all available component templates", {}, async () => {
        const response = await wsClient.sendCommand({
            type: "list_components",
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
        const templateList = data.templates
            ?.map((t) => `- ${t.type}: ${t.name} - ${t.description}`)
            .join("\n") || "No templates available";
        return {
            content: [
                {
                    type: "text",
                    text: `Available component templates:\n${templateList}`,
                },
            ],
        };
    });
}
//# sourceMappingURL=components.js.map
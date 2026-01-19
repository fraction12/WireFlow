/**
 * WebSocket Protocol Types for MCP Server <-> WireFlow Communication
 */
// ============================================================
// Utility Functions
// ============================================================
export function generateCorrelationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
}
export function generateTimestamp() {
    return new Date().toISOString();
}
export function isErrorResponse(response) {
    return response.success === false;
}
export function isEvent(message) {
    return (typeof message === "object" &&
        message !== null &&
        "type" in message &&
        !("correlationId" in message) &&
        !("success" in message));
}
//# sourceMappingURL=protocol.js.map
/**
 * ID Generation utilities matching WireFlow's patterns
 */
export function generateId() {
    return `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
export function generateFrameId() {
    return `frame_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
export function generateGroupId() {
    return `grp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
export function generateElementGroupId() {
    return `egrp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
//# sourceMappingURL=idGenerator.js.map
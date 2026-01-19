/**
 * ID Generation utilities matching WireFlow's patterns
 */

export function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateFrameId(): string {
  return `frame_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateGroupId(): string {
  return `grp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function generateElementGroupId(): string {
  return `egrp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

import type { WorkspaceState, Frame, ComponentGroup } from './types';

const STORAGE_KEY = 'wireflow-workspace';
const CURRENT_VERSION = 1;

/**
 * Save workspace state to localStorage with debouncing handled by caller.
 * Returns true on success, false on failure (e.g., storage quota exceeded).
 */
export function saveWorkspace(state: WorkspaceState): boolean {
  try {
    const data: WorkspaceState = {
      version: CURRENT_VERSION,
      frames: state.frames,
      componentGroups: state.componentGroups,
      activeFrameId: state.activeFrameId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    // Storage quota exceeded or other localStorage errors
    console.warn('Failed to save workspace:', error);
    return false;
  }
}

/**
 * Load workspace state from localStorage.
 * Returns null if no data exists, data is invalid, or an error occurs.
 * The app should fall back to default state when null is returned.
 */
export function loadWorkspace(): WorkspaceState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored);

    // Validate basic structure
    if (!isValidWorkspaceState(data)) {
      console.warn('Invalid workspace state in storage, ignoring');
      return null;
    }

    return data;
  } catch (error) {
    // JSON parse error or other issues
    console.warn('Failed to load workspace:', error);
    return null;
  }
}

/**
 * Clear saved workspace state from localStorage.
 */
export function clearWorkspace(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear workspace:', error);
  }
}

/**
 * Validate that data has the expected workspace state structure.
 * Does not validate deep element structure to keep restore fast.
 */
function isValidWorkspaceState(data: unknown): data is WorkspaceState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields exist with correct types
  if (typeof obj.version !== 'number') {
    return false;
  }

  if (!Array.isArray(obj.frames)) {
    return false;
  }

  if (!Array.isArray(obj.componentGroups)) {
    return false;
  }

  if (typeof obj.activeFrameId !== 'string') {
    return false;
  }

  // Validate frames have required structure
  for (const frame of obj.frames) {
    if (!isValidFrame(frame)) {
      return false;
    }
  }

  // Validate component groups have required structure
  for (const group of obj.componentGroups) {
    if (!isValidComponentGroup(group)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate frame structure
 */
function isValidFrame(frame: unknown): frame is Frame {
  if (typeof frame !== 'object' || frame === null) {
    return false;
  }

  const obj = frame as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.type === 'string' &&
    Array.isArray(obj.elements) &&
    typeof obj.createdAt === 'string'
  );
}

/**
 * Validate component group structure
 */
function isValidComponentGroup(group: unknown): group is ComponentGroup {
  if (typeof group !== 'object' || group === null) {
    return false;
  }

  const obj = group as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.componentType === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    Array.isArray(obj.elementIds) &&
    typeof obj.createdAt === 'string'
  );
}

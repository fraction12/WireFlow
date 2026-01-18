import type { WorkspaceState, Frame, ComponentGroup, ElementGroup, UserComponent, ComponentInstance } from './types';

const STORAGE_KEY = 'wireflow-workspace';
const CURRENT_VERSION = 1;

/** Result type for save operations with detailed error information */
export type SaveResult =
  | { success: true }
  | { success: false; error: 'quota_exceeded' | 'storage_unavailable' | 'unknown'; message: string };

/** Result type for load operations with detailed error information */
export type LoadResult =
  | { success: true; data: WorkspaceState }
  | { success: false; error: 'no_data' | 'invalid_json' | 'invalid_schema' | 'storage_unavailable' | 'unknown'; message: string };

/**
 * Save workspace state to localStorage with debouncing handled by caller.
 * Returns detailed result with error information for UI notification.
 */
export function saveWorkspace(state: WorkspaceState): SaveResult {
  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'storage_unavailable', message: 'localStorage is not available' };
    }

    const data: WorkspaceState = {
      version: CURRENT_VERSION,
      frames: state.frames,
      componentGroups: state.componentGroups,
      elementGroups: state.elementGroups || [],
      userComponents: state.userComponents || [],
      componentInstances: state.componentInstances || [],
      activeFrameId: state.activeFrameId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { success: true };
  } catch (error) {
    // Detect quota exceeded errors
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        return {
          success: false,
          error: 'quota_exceeded',
          message: 'Storage quota exceeded. Try deleting some frames or elements to free up space.'
        };
      }
      if (error.name === 'SecurityError') {
        return {
          success: false,
          error: 'storage_unavailable',
          message: 'Storage access denied. Check browser privacy settings.'
        };
      }
    }
    console.warn('Failed to save workspace:', error);
    return {
      success: false,
      error: 'unknown',
      message: 'Failed to save workspace. Changes may not persist.'
    };
  }
}

/**
 * Legacy wrapper for backward compatibility - returns boolean
 */
export function saveWorkspaceSimple(state: WorkspaceState): boolean {
  return saveWorkspace(state).success;
}

/**
 * Load workspace state from localStorage with detailed error reporting.
 * Returns result object with data on success or error details on failure.
 */
export function loadWorkspaceWithResult(): LoadResult {
  try {
    // Check if localStorage is available
    if (typeof localStorage === 'undefined') {
      return { success: false, error: 'storage_unavailable', message: 'localStorage is not available' };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { success: false, error: 'no_data', message: 'No saved workspace found' };
    }

    let data: unknown;
    try {
      data = JSON.parse(stored);
    } catch {
      return { success: false, error: 'invalid_json', message: 'Saved data is corrupted and cannot be parsed' };
    }

    // Validate basic structure
    if (!isValidWorkspaceState(data)) {
      return { success: false, error: 'invalid_schema', message: 'Saved data has invalid structure. Starting fresh.' };
    }

    // Ensure all arrays exist (backward compatibility)
    const result: WorkspaceState = {
      ...data,
      elementGroups: data.elementGroups || [],
      userComponents: data.userComponents || [],
      componentInstances: data.componentInstances || [],
    };
    return { success: true, data: result };
  } catch (error) {
    console.warn('Failed to load workspace:', error);
    return { success: false, error: 'unknown', message: 'Failed to load workspace' };
  }
}

/**
 * Load workspace state from localStorage.
 * Returns null if no data exists, data is invalid, or an error occurs.
 * The app should fall back to default state when null is returned.
 */
export function loadWorkspace(): WorkspaceState | null {
  const result = loadWorkspaceWithResult();
  return result.success ? result.data : null;
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
 * Validates frames, elements, and component groups to ensure safe restore.
 */
function isValidWorkspaceState(data: unknown): data is WorkspaceState {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check version matches current schema to avoid loading incompatible data
  if (typeof obj.version !== 'number' || obj.version !== CURRENT_VERSION) {
    return false;
  }

  if (!Array.isArray(obj.frames)) {
    return false;
  }

  if (!Array.isArray(obj.componentGroups)) {
    return false;
  }

  // elementGroups is optional for backward compatibility (defaults to [])
  if (obj.elementGroups !== undefined && !Array.isArray(obj.elementGroups)) {
    return false;
  }

  // userComponents is optional for backward compatibility (defaults to [])
  if (obj.userComponents !== undefined && !Array.isArray(obj.userComponents)) {
    return false;
  }

  // componentInstances is optional for backward compatibility (defaults to [])
  if (obj.componentInstances !== undefined && !Array.isArray(obj.componentInstances)) {
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

  // Validate element groups have required structure (if present)
  if (Array.isArray(obj.elementGroups)) {
    for (const group of obj.elementGroups) {
      if (!isValidElementGroup(group)) {
        return false;
      }
    }
  }

  // Validate user components have required structure (if present)
  if (Array.isArray(obj.userComponents)) {
    for (const component of obj.userComponents) {
      if (!isValidUserComponent(component)) {
        return false;
      }
    }
  }

  // Validate component instances have required structure (if present)
  if (Array.isArray(obj.componentInstances)) {
    for (const instance of obj.componentInstances) {
      if (!isValidComponentInstance(instance)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate frame structure including its elements
 */
function isValidFrame(frame: unknown): frame is Frame {
  if (typeof frame !== 'object' || frame === null) {
    return false;
  }

  const obj = frame as Record<string, unknown>;

  if (
    typeof obj.id !== 'string' ||
    typeof obj.name !== 'string' ||
    typeof obj.type !== 'string' ||
    !Array.isArray(obj.elements) ||
    typeof obj.createdAt !== 'string'
  ) {
    return false;
  }

  // Validate each element has required base fields
  for (const element of obj.elements) {
    if (!isValidElement(element)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate element has required base fields (id, type, x, y, width, height)
 */
function isValidElement(element: unknown): boolean {
  if (typeof element !== 'object' || element === null) {
    return false;
  }

  const obj = element as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number'
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

/**
 * Validate user-created element group structure
 */
function isValidElementGroup(group: unknown): group is ElementGroup {
  if (typeof group !== 'object' || group === null) {
    return false;
  }

  const obj = group as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    Array.isArray(obj.elementIds) &&
    typeof obj.frameId === 'string' &&
    typeof obj.createdAt === 'string'
  );
}

/**
 * Validate user component structure
 */
function isValidUserComponent(component: unknown): component is UserComponent {
  if (typeof component !== 'object' || component === null) {
    return false;
  }

  const obj = component as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    Array.isArray(obj.masterElements) &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  );
}

/**
 * Validate component instance structure
 */
function isValidComponentInstance(instance: unknown): instance is ComponentInstance {
  if (typeof instance !== 'object' || instance === null) {
    return false;
  }

  const obj = instance as Record<string, unknown>;

  return (
    typeof obj.id === 'string' &&
    typeof obj.componentId === 'string' &&
    typeof obj.frameId === 'string' &&
    typeof obj.x === 'number' &&
    typeof obj.y === 'number' &&
    typeof obj.createdAt === 'string'
  );
}

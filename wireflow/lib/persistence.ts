import type { WorkspaceState, Frame, ComponentGroup, ElementGroup, UserComponent, ComponentInstance } from './types';

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
      elementGroups: state.elementGroups || [],
      userComponents: state.userComponents || [],
      componentInstances: state.componentInstances || [],
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

    // Ensure all arrays exist (backward compatibility)
    return {
      ...data,
      elementGroups: data.elementGroups || [],
      userComponents: data.userComponents || [],
      componentInstances: data.componentInstances || [],
    };
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

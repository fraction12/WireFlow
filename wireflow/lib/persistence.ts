import type { WorkspaceState, Frame, ComponentGroup, ElementGroup, UserComponent, ComponentInstance } from './types';

const STORAGE_KEY = 'wireflow-workspace';
const CURRENT_VERSION = 1;

// Minimum version we can migrate from (older versions are truly incompatible)
const MIN_SUPPORTED_VERSION = 0;

/**
 * Migration functions to upgrade data from one version to the next.
 * Each function takes data at version N and returns data at version N+1.
 * Add new migrations here when incrementing CURRENT_VERSION.
 */
type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

const migrations: Record<number, MigrationFn> = {
  // Migration from version 0 (pre-versioned data) to version 1
  // Version 0 was the initial schema, so this is mostly just adding the version field
  0: (data) => {
    return {
      ...data,
      version: 1,
      // Ensure optional arrays exist (these were added in v1)
      elementGroups: data.elementGroups || [],
      userComponents: data.userComponents || [],
      componentInstances: data.componentInstances || [],
    };
  },
  // Future migrations go here:
  // 1: (data) => { /* migrate v1 -> v2 */ return { ...data, version: 2 }; },
};

/**
 * Migrate data from its current version to CURRENT_VERSION.
 * Returns the migrated data, or null if migration is not possible.
 */
function migrateData(data: Record<string, unknown>): Record<string, unknown> | null {
  let version = typeof data.version === 'number' ? data.version : 0;
  let migratedData = { ...data };

  // Cannot migrate from future versions
  if (version > CURRENT_VERSION) {
    console.warn(
      `Cannot load data from future version ${version}. Current version is ${CURRENT_VERSION}. ` +
      'Please update the application.'
    );
    return null;
  }

  // Cannot migrate from versions older than minimum supported
  if (version < MIN_SUPPORTED_VERSION) {
    console.warn(
      `Cannot migrate data from version ${version}. Minimum supported version is ${MIN_SUPPORTED_VERSION}.`
    );
    return null;
  }

  // Apply migrations sequentially
  while (version < CURRENT_VERSION) {
    const migrationFn = migrations[version];
    if (!migrationFn) {
      console.warn(`Missing migration function for version ${version} to ${version + 1}`);
      return null;
    }

    try {
      migratedData = migrationFn(migratedData);
      version++;
      console.info(`Migrated workspace data from version ${version - 1} to ${version}`);
    } catch (error) {
      console.warn(`Migration from version ${version} failed:`, error);
      return null;
    }
  }

  return migratedData;
}

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
 * Automatically migrates older versions to the current schema.
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

    // Validate and migrate to current version
    const migratedData = validateAndMigrateWorkspaceState(data);
    if (!migratedData) {
      // Check if it's a future version to give a more helpful error message
      if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;
        if (typeof obj.version === 'number' && obj.version > CURRENT_VERSION) {
          return {
            success: false,
            error: 'invalid_schema',
            message: `Saved data is from a newer version (v${obj.version}). Please update the application to load this data.`
          };
        }
      }
      return { success: false, error: 'invalid_schema', message: 'Saved data has invalid structure and cannot be migrated. Starting fresh.' };
    }

    // Ensure all optional arrays exist (migration should handle this, but be safe)
    const result: WorkspaceState = {
      ...migratedData,
      elementGroups: migratedData.elementGroups || [],
      userComponents: migratedData.userComponents || [],
      componentInstances: migratedData.componentInstances || [],
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
 * Validate that data has the expected workspace state structure (post-migration).
 * This validates the current schema only - version migration happens before this is called.
 */
function isValidWorkspaceStructure(data: Record<string, unknown>): boolean {
  if (!Array.isArray(data.frames)) {
    return false;
  }

  if (!Array.isArray(data.componentGroups)) {
    return false;
  }

  // elementGroups is optional for backward compatibility (defaults to [])
  if (data.elementGroups !== undefined && !Array.isArray(data.elementGroups)) {
    return false;
  }

  // userComponents is optional for backward compatibility (defaults to [])
  if (data.userComponents !== undefined && !Array.isArray(data.userComponents)) {
    return false;
  }

  // componentInstances is optional for backward compatibility (defaults to [])
  if (data.componentInstances !== undefined && !Array.isArray(data.componentInstances)) {
    return false;
  }

  if (typeof data.activeFrameId !== 'string') {
    return false;
  }

  // Validate frames have required structure
  for (const frame of data.frames) {
    if (!isValidFrame(frame)) {
      return false;
    }
  }

  // Validate component groups have required structure
  for (const group of data.componentGroups) {
    if (!isValidComponentGroup(group)) {
      return false;
    }
  }

  // Validate element groups have required structure (if present)
  if (Array.isArray(data.elementGroups)) {
    for (const group of data.elementGroups) {
      if (!isValidElementGroup(group)) {
        return false;
      }
    }
  }

  // Validate user components have required structure (if present)
  if (Array.isArray(data.userComponents)) {
    for (const component of data.userComponents) {
      if (!isValidUserComponent(component)) {
        return false;
      }
    }
  }

  // Validate component instances have required structure (if present)
  if (Array.isArray(data.componentInstances)) {
    for (const instance of data.componentInstances) {
      if (!isValidComponentInstance(instance)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate and migrate data to the current workspace state structure.
 * Attempts migration for older versions before validation.
 * Returns the migrated data if valid, or null if migration/validation fails.
 */
function validateAndMigrateWorkspaceState(data: unknown): WorkspaceState | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Attempt to migrate data to current version
  const migratedData = migrateData(obj);
  if (!migratedData) {
    return null;
  }

  // Validate the migrated structure
  if (!isValidWorkspaceStructure(migratedData)) {
    return null;
  }

  return migratedData as unknown as WorkspaceState;
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

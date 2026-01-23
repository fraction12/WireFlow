'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { CanvasElement, ElementType, ComponentGroup, ElementGroup, UserComponent, ComponentInstance } from '@/lib/types';
import { usePanelAnimation } from '@/lib/usePanelAnimation';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Square,
  Circle,
  Diamond,
  Type,
  ArrowRight,
  Minus,
  Pencil,
  PencilLine,
  Folder,
  Component,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';

interface LayersPanelProps {
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Callback when panel is toggled */
  onToggle: () => void;
  /** Elements in current frame (in array order = z-order) */
  elements: CanvasElement[];
  /** Component groups (from templates) */
  componentGroups: ComponentGroup[];
  /** User-created element groups */
  elementGroups: ElementGroup[];
  /** User-created component library */
  userComponents: UserComponent[];
  /** Component instances in current frame */
  componentInstances: ComponentInstance[];
  /** Currently selected element ID (single selection) */
  selectedElementId: string | null;
  /** Currently selected element IDs (multi-selection) */
  selectedElementIds: Set<string>;
  /** Currently selected instance ID */
  selectedInstanceId: string | null;
  /** Callback when element is selected via panel click */
  onSelectElement: (elementId: string, addToSelection: boolean) => void;
  /** Callback when group is selected (selects all elements in group) */
  onSelectGroup: (groupId: string, groupType: 'component' | 'element') => void;
  /** Callback when component instance is selected via panel click */
  onSelectInstance: (instanceId: string) => void;
  /** Callback when elements are reordered via drag-drop */
  onReorderElements: (fromIndex: number, toIndex: number) => void;
  /** Callback when element visibility is toggled */
  onToggleVisibility: (elementId: string) => void;
  /** Callback when element lock is toggled */
  onToggleLock: (elementId: string) => void;
  /** Callback when element name is changed */
  onRenameElement: (elementId: string, newName: string) => void;
  /** Callback when instance visibility is toggled */
  onToggleInstanceVisibility: (instanceId: string) => void;
  /** Callback when instance lock is toggled */
  onToggleInstanceLock: (instanceId: string) => void;
  /** Callback when instance name is changed */
  onRenameInstance: (instanceId: string, newName: string) => void;
  /** Callback when instances are reordered via drag-drop */
  onReorderInstances: (fromIndex: number, toIndex: number) => void;
  /** Callback when instance is deleted */
  onDeleteInstance: (instanceId: string) => void;
  /** Callback when element group visibility is toggled */
  onToggleGroupVisibility: (groupId: string) => void;
  /** Callback when element group lock is toggled */
  onToggleGroupLock: (groupId: string) => void;
  /** Callback when element group name is changed */
  onRenameGroup: (groupId: string, newName: string) => void;
  /** Callback when element groups are reordered via drag-drop */
  onReorderGroups: (fromIndex: number, toIndex: number) => void;
}

// Element type to icon mapping
const ELEMENT_TYPE_ICONS: Record<ElementType, React.ComponentType<{ size?: number; className?: string }>> = {
  rectangle: Square,
  ellipse: Circle,
  diamond: Diamond,
  text: Type,
  arrow: ArrowRight,
  line: Minus,
  freedraw: Pencil,
};

// Default display names for element types
const ELEMENT_TYPE_NAMES: Record<ElementType, string> = {
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  text: 'Text',
  arrow: 'Arrow',
  line: 'Line',
  freedraw: 'Drawing',
};

/** Get display name for an element */
function getElementDisplayName(element: CanvasElement): string {
  if (element.name) return element.name;

  // For text elements, show a preview of the content
  if (element.type === 'text' && 'content' in element && element.content) {
    const preview = element.content.slice(0, 20);
    return preview.length < element.content.length ? `${preview}...` : preview;
  }

  return ELEMENT_TYPE_NAMES[element.type] || 'Element';
}

/** Get display name for a component instance */
function getInstanceDisplayName(instance: ComponentInstance, component: UserComponent | undefined): string {
  // Use custom name if set
  if (instance.name) return instance.name;
  // Fall back to component name
  return component?.name || 'Unknown Component';
}

/** Generate a meaningful display name for an element group */
function getGroupDisplayName(
  group: ElementGroup,
  groupElements: CanvasElement[],
  allElementGroups: ElementGroup[]
): string {
  // Use custom name if set
  if (group.name) return group.name;

  // Try to derive name from first element with a custom name
  const firstNamedElement = groupElements.find(el => el.name);
  if (firstNamedElement?.name) {
    return firstNamedElement.name;
  }

  // Try to use first text element's content as the group name
  const firstTextElement = groupElements.find(
    el => el.type === 'text' && 'content' in el && el.content
  );
  if (firstTextElement && 'content' in firstTextElement && firstTextElement.content) {
    const preview = firstTextElement.content.slice(0, 15);
    return preview.length < firstTextElement.content.length ? `${preview}...` : preview;
  }

  // Fall back to numbered group name
  // Sort groups by creation date to get consistent numbering
  const sortedGroups = [...allElementGroups].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const groupIndex = sortedGroups.findIndex(g => g.id === group.id);
  return `Group ${groupIndex + 1}`;
}

export function LayersPanel({
  isExpanded,
  onToggle,
  elements,
  componentGroups,
  elementGroups,
  userComponents,
  componentInstances,
  selectedElementId,
  selectedElementIds,
  selectedInstanceId,
  onSelectElement,
  onSelectGroup,
  onSelectInstance,
  onReorderElements,
  onToggleVisibility,
  onToggleLock,
  onRenameElement,
  onToggleInstanceVisibility,
  onToggleInstanceLock,
  onRenameInstance,
  onReorderInstances,
  onDeleteInstance,
  onToggleGroupVisibility,
  onToggleGroupLock,
  onRenameGroup,
  onReorderGroups,
}: LayersPanelProps) {
  // Manage content visibility timing for smooth animation
  const contentVisible = usePanelAnimation(isExpanded);

  // Editing state for inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<'element' | 'instance' | 'group'>('element');
  const inputRef = useRef<HTMLInputElement>(null);
  const instanceInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);

  // Drag-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('above');

  // Collapsed groups state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Toggle group collapse
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId) {
      if (editingType === 'element' && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (editingType === 'instance' && instanceInputRef.current) {
        instanceInputRef.current.focus();
        instanceInputRef.current.select();
      } else if (editingType === 'group' && groupInputRef.current) {
        groupInputRef.current.focus();
        groupInputRef.current.select();
      }
    }
  }, [editingId, editingType]);

  // Start editing element name
  const startEditing = useCallback((element: CanvasElement, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(element.id);
    setEditingName(element.name || getElementDisplayName(element));
    setEditingType('element');
  }, []);

  // Start editing instance name
  const startEditingInstance = useCallback((instance: ComponentInstance, component: UserComponent | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(instance.id);
    setEditingName(instance.name || getInstanceDisplayName(instance, component));
    setEditingType('instance');
  }, []);

  // Start editing group name
  const startEditingGroup = useCallback((group: ElementGroup, groupElements: CanvasElement[], e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(group.id);
    setEditingName(group.name || getGroupDisplayName(group, groupElements, elementGroups));
    setEditingType('group');
  }, [elementGroups]);

  // Save edited name
  const saveEdit = useCallback(() => {
    if (editingId) {
      if (editingType === 'element') {
        onRenameElement(editingId, editingName);
      } else if (editingType === 'instance') {
        onRenameInstance(editingId, editingName);
      } else if (editingType === 'group') {
        onRenameGroup(editingId, editingName);
      }
      setEditingId(null);
      setEditingName('');
    }
  }, [editingId, editingName, editingType, onRenameElement, onRenameInstance, onRenameGroup]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  // Handle element click for selection
  const handleElementClick = useCallback((elementId: string, e: React.MouseEvent) => {
    const addToSelection = e.shiftKey || e.ctrlKey || e.metaKey;
    onSelectElement(elementId, addToSelection);
  }, [onSelectElement]);

  // Drag handlers
  const handleDragStart = useCallback((displayIndex: number) => (e: React.DragEvent) => {
    setDraggedIndex(displayIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(displayIndex));
    // Add dragging class to body for cursor
    document.body.classList.add('dragging-layer');
  }, []);

  const handleDragOver = useCallback((displayIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(displayIndex);

    // Detect if cursor is in top or bottom half of the element
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropPosition(e.clientY < midpoint ? 'above' : 'below');
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
    setDropPosition('above');
  }, []);

  const handleDrop = useCallback((toDisplayIndex: number, position: 'above' | 'below' = dropPosition) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toDisplayIndex) {
      // Convert display indices (reversed) back to actual array indices
      const actualFromIndex = elements.length - 1 - draggedIndex;
      let actualToIndex = elements.length - 1 - toDisplayIndex;

      // Adjust target index based on drop position
      // If dropping below, we need to adjust the target index
      if (position === 'below') {
        actualToIndex = Math.max(0, actualToIndex - 1);
      }

      // Don't reorder if it would result in no change
      if (actualFromIndex !== actualToIndex) {
        onReorderElements(actualFromIndex, actualToIndex);
      }
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
    setDropPosition('above');
    document.body.classList.remove('dragging-layer');
  }, [draggedIndex, dropPosition, elements.length, onReorderElements]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
    setDropPosition('above');
    document.body.classList.remove('dragging-layer');
  }, []);

  // Instance drag-drop state
  const [draggedInstanceIndex, setDraggedInstanceIndex] = useState<number | null>(null);
  const [dropInstanceTargetIndex, setDropInstanceTargetIndex] = useState<number | null>(null);
  const [dropInstancePosition, setDropInstancePosition] = useState<'above' | 'below'>('above');

  // Instance drag handlers
  const handleInstanceDragStart = useCallback((displayIndex: number) => (e: React.DragEvent) => {
    setDraggedInstanceIndex(displayIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `instance:${displayIndex}`);
    document.body.classList.add('dragging-layer');
  }, []);

  const handleInstanceDragOver = useCallback((displayIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropInstanceTargetIndex(displayIndex);

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropInstancePosition(e.clientY < midpoint ? 'above' : 'below');
  }, []);

  const handleInstanceDragLeave = useCallback(() => {
    setDropInstanceTargetIndex(null);
    setDropInstancePosition('above');
  }, []);

  const handleInstanceDrop = useCallback((toDisplayIndex: number, position: 'above' | 'below' = dropInstancePosition) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedInstanceIndex !== null && draggedInstanceIndex !== toDisplayIndex) {
      // Instances are sorted by creation date (newest first), so display index = array index
      let actualToIndex = toDisplayIndex;

      // Adjust target index based on drop position
      if (position === 'below') {
        actualToIndex = Math.min(componentInstances.length - 1, actualToIndex + 1);
      }

      if (draggedInstanceIndex !== actualToIndex) {
        onReorderInstances(draggedInstanceIndex, actualToIndex);
      }
    }
    setDraggedInstanceIndex(null);
    setDropInstanceTargetIndex(null);
    setDropInstancePosition('above');
    document.body.classList.remove('dragging-layer');
  }, [draggedInstanceIndex, dropInstancePosition, componentInstances.length, onReorderInstances]);

  const handleInstanceDragEnd = useCallback(() => {
    setDraggedInstanceIndex(null);
    setDropInstanceTargetIndex(null);
    setDropInstancePosition('above');
    document.body.classList.remove('dragging-layer');
  }, []);

  // Group drag-drop state
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [dropGroupTargetIndex, setDropGroupTargetIndex] = useState<number | null>(null);
  const [dropGroupPosition, setDropGroupPosition] = useState<'above' | 'below'>('above');

  // Group drag handlers
  const handleGroupDragStart = useCallback((groupIndex: number) => (e: React.DragEvent) => {
    setDraggedGroupIndex(groupIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `group:${groupIndex}`);
    document.body.classList.add('dragging-layer');
  }, []);

  const handleGroupDragOver = useCallback((groupIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropGroupTargetIndex(groupIndex);

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDropGroupPosition(e.clientY < midpoint ? 'above' : 'below');
  }, []);

  const handleGroupDragLeave = useCallback(() => {
    setDropGroupTargetIndex(null);
    setDropGroupPosition('above');
  }, []);

  const handleGroupDrop = useCallback((toGroupIndex: number, position: 'above' | 'below' = dropGroupPosition) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedGroupIndex !== null && draggedGroupIndex !== toGroupIndex) {
      let actualToIndex = toGroupIndex;

      // Adjust target index based on drop position
      if (position === 'below') {
        actualToIndex = Math.min(elementGroups.length - 1, actualToIndex + 1);
      }

      if (draggedGroupIndex !== actualToIndex) {
        onReorderGroups(draggedGroupIndex, actualToIndex);
      }
    }
    setDraggedGroupIndex(null);
    setDropGroupTargetIndex(null);
    setDropGroupPosition('above');
    document.body.classList.remove('dragging-layer');
  }, [draggedGroupIndex, dropGroupPosition, elementGroups.length, onReorderGroups]);

  const handleGroupDragEnd = useCallback(() => {
    setDraggedGroupIndex(null);
    setDropGroupTargetIndex(null);
    setDropGroupPosition('above');
    document.body.classList.remove('dragging-layer');
  }, []);

  // Build hierarchical layer structure
  // Groups are placed at the z-index of their first (topmost in visual order) element
  type LayerItem =
    | { type: 'element'; element: CanvasElement; displayIndex: number }
    | { type: 'componentGroup'; group: ComponentGroup; elements: CanvasElement[] }
    | { type: 'elementGroup'; group: ElementGroup; elements: CanvasElement[] }
    | { type: 'userComponentInstance'; instance: ComponentInstance; component: UserComponent | undefined; instanceIndex: number };

  const buildLayerHierarchy = useCallback((): LayerItem[] => {
    const items: LayerItem[] = [];
    const processedElementIds = new Set<string>();
    const processedGroupIds = new Set<string>();

    // Process elements in reverse order (topmost first for display)
    const reversedElements = [...elements].reverse();

    reversedElements.forEach((element, displayIndex) => {
      if (processedElementIds.has(element.id)) return;

      // Check if element belongs to a component group
      if (element.groupId) {
        const group = componentGroups.find(g => g.id === element.groupId);
        if (group && !processedGroupIds.has(group.id)) {
          processedGroupIds.add(group.id);
          // Get all elements in this group (preserving z-order)
          const groupElements = reversedElements.filter(el => el.groupId === group.id);
          groupElements.forEach(el => processedElementIds.add(el.id));
          items.push({ type: 'componentGroup', group, elements: groupElements });
          return;
        }
      }

      // Check if element belongs to a user-created element group
      if (element.elementGroupId) {
        const group = elementGroups.find(g => g.id === element.elementGroupId);
        if (group && !processedGroupIds.has(group.id)) {
          processedGroupIds.add(group.id);
          // Get all elements in this group (preserving z-order)
          const groupElements = reversedElements.filter(el => el.elementGroupId === group.id);
          groupElements.forEach(el => processedElementIds.add(el.id));
          items.push({ type: 'elementGroup', group, elements: groupElements });
          return;
        }
      }

      // Ungrouped element
      if (!processedElementIds.has(element.id)) {
        processedElementIds.add(element.id);
        items.push({ type: 'element', element, displayIndex });
      }
    });

    // Add user component instances (sorted by creation order, newest first)
    const sortedInstances = [...componentInstances].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    sortedInstances.forEach((instance, instanceIndex) => {
      const component = userComponents.find(c => c.id === instance.componentId);
      items.push({ type: 'userComponentInstance', instance, component, instanceIndex });
    });

    return items;
  }, [elements, componentGroups, elementGroups, componentInstances, userComponents]);

  const layerItems = buildLayerHierarchy();

  // Check if an element matches the search query
  const elementMatchesSearch = useCallback((element: CanvasElement, query: string): boolean => {
    if (!query.trim()) return true;
    const lowerQuery = query.toLowerCase().trim();

    // Match by element name
    if (element.name?.toLowerCase().includes(lowerQuery)) return true;

    // Match by element type
    if (ELEMENT_TYPE_NAMES[element.type].toLowerCase().includes(lowerQuery)) return true;

    // Match by text content for text elements
    if (element.type === 'text' && 'content' in element && element.content) {
      if (element.content.toLowerCase().includes(lowerQuery)) return true;
    }

    return false;
  }, []);

  // Filter layer items based on search query
  const filteredLayerItems = useMemo(() => {
    if (!searchQuery.trim()) return layerItems;

    return layerItems.filter(item => {
      if (item.type === 'element') {
        return elementMatchesSearch(item.element, searchQuery);
      }

      if (item.type === 'componentGroup' || item.type === 'elementGroup') {
        // Show group if any of its elements match
        return item.elements.some(el => elementMatchesSearch(el, searchQuery));
      }

      if (item.type === 'userComponentInstance') {
        const lowerQuery = searchQuery.toLowerCase().trim();
        // Match by instance name
        if (item.instance.name?.toLowerCase().includes(lowerQuery)) return true;
        // Match by component name
        const componentName = item.component?.name || 'Unknown Component';
        return componentName.toLowerCase().includes(lowerQuery);
      }

      return true;
    });
  }, [layerItems, searchQuery, elementMatchesSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  // Render a single element row
  const renderElementRow = (
    element: CanvasElement,
    displayIndex: number,
    indent: boolean = false
  ) => {
    const isSelected = element.id === selectedElementId || selectedElementIds.has(element.id);
    const isEditing = element.id === editingId;
    const isHidden = element.visible === false;
    const isLocked = element.locked === true;
    const isDragging = displayIndex === draggedIndex;
    const isDropTarget = displayIndex === dropTargetIndex && draggedIndex !== null && displayIndex !== draggedIndex;
    const isDropAbove = isDropTarget && dropPosition === 'above';
    const isDropBelow = isDropTarget && dropPosition === 'below';

    const Icon = ELEMENT_TYPE_ICONS[element.type] || Square;

    return (
      <div
        key={element.id}
        draggable={!isEditing && !indent}
        onDragStart={indent ? undefined : handleDragStart(displayIndex)}
        onDragOver={indent ? undefined : handleDragOver(displayIndex)}
        onDragLeave={indent ? undefined : handleDragLeave}
        onDrop={indent ? undefined : handleDrop(displayIndex)}
        onDragEnd={indent ? undefined : handleDragEnd}
        onClick={(e) => !isEditing && handleElementClick(element.id, e)}
        className={`
          group flex items-center gap-2 px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800
          transition-all duration-150 cursor-pointer
          ${indent ? 'pl-8' : ''}
          ${isSelected
            ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent'
          }
          ${isHidden ? 'opacity-50' : ''}
          ${isDragging ? 'opacity-50 bg-zinc-100 dark:bg-zinc-800' : ''}
          ${isDropAbove ? 'border-t-2 border-t-blue-500' : ''}
          ${isDropBelow ? 'border-b-2 border-b-blue-500' : ''}
        `}
        role="listitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-label={`Layer: ${getElementDisplayName(element)}${isHidden ? ', hidden' : ''}${isLocked ? ', locked' : ''}`}
      >
        {/* Drag handle (only for non-indented) */}
        {!indent && (
          <div
            className="flex-shrink-0 cursor-grab active:cursor-grabbing text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Drag to reorder"
          >
            <GripVertical size={14} />
          </div>
        )}

        {/* Element type icon */}
        <div className="flex-shrink-0 text-zinc-500 dark:text-zinc-400">
          <Icon size={16} />
        </div>

        {/* Element name (editable) */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-sm px-1 py-0.5 border border-blue-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Edit element name"
            />
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-1 text-left text-sm text-zinc-700 dark:text-zinc-300 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 -mx-1 group/name"
              onDoubleClick={(e) => startEditing(element, e)}
              title={`${getElementDisplayName(element)} (double-click to rename)`}
            >
              <span className="truncate">{getElementDisplayName(element)}</span>
              <PencilLine
                size={12}
                className="flex-shrink-0 opacity-0 group-hover/name:opacity-60 transition-opacity"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(element.id);
          }}
          className={`
            flex-shrink-0 p-1 rounded transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${isHidden
              ? 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }
          `}
          title={isHidden ? 'Show element' : 'Hide element'}
          aria-label={isHidden ? 'Show element' : 'Hide element'}
          aria-pressed={!isHidden}
        >
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        {/* Lock toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(element.id);
          }}
          className={`
            flex-shrink-0 p-1 rounded transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
            ${isLocked
              ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }
          `}
          title={isLocked ? 'Unlock element' : 'Lock element'}
          aria-label={isLocked ? 'Unlock element' : 'Lock element'}
          aria-pressed={isLocked}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>
    );
  };

  // Render a group header
  // Render a component group header (read-only, no interactions beyond collapse/select)
  const renderComponentGroupHeader = (
    groupId: string,
    name: string,
    elementCount: number,
    isAllSelected: boolean
  ) => {
    const isCollapsed = collapsedGroups.has(groupId);

    return (
      <div
        key={groupId}
        onClick={() => onSelectGroup(groupId, 'component')}
        className={`
          group flex items-center gap-2 px-2 py-2 border-b border-zinc-100 dark:border-zinc-800
          transition-all duration-150 cursor-pointer
          ${isAllSelected
            ? 'bg-purple-50 dark:bg-purple-950 border-l-4 border-l-purple-500'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent'
          }
        `}
        role="treeitem"
        aria-expanded={!isCollapsed}
        aria-label={`Component: ${name} (${elementCount} elements)`}
      >
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupCollapse(groupId);
          }}
          className="flex-shrink-0 p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Group icon */}
        <div className="flex-shrink-0 text-purple-500 dark:text-purple-400">
          <Component size={16} />
        </div>

        {/* Group name */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {name}
          </span>
          <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
            {elementCount}
          </span>
        </div>
      </div>
    );
  };

  // Render an element group row with full interactions (visibility, lock, rename, drag-drop)
  const renderElementGroupRow = (
    group: ElementGroup,
    groupElements: CanvasElement[],
    groupIndex: number,
    isAllSelected: boolean
  ) => {
    const isCollapsed = collapsedGroups.has(group.id);
    const isEditing = group.id === editingId && editingType === 'group';
    const isHidden = group.visible === false;
    const isLocked = group.locked === true;
    const isDragging = groupIndex === draggedGroupIndex;
    const isDropTarget = groupIndex === dropGroupTargetIndex && draggedGroupIndex !== null && groupIndex !== draggedGroupIndex;
    const isDropAbove = isDropTarget && dropGroupPosition === 'above';
    const isDropBelow = isDropTarget && dropGroupPosition === 'below';
    const displayName = getGroupDisplayName(group, groupElements, elementGroups);

    return (
      <div
        key={group.id}
        draggable={!isEditing}
        onDragStart={handleGroupDragStart(groupIndex)}
        onDragOver={handleGroupDragOver(groupIndex)}
        onDragLeave={handleGroupDragLeave}
        onDrop={handleGroupDrop(groupIndex)}
        onDragEnd={handleGroupDragEnd}
        onClick={() => !isEditing && onSelectGroup(group.id, 'element')}
        className={`
          group flex items-center gap-2 px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800
          transition-all duration-150 cursor-pointer
          ${isAllSelected
            ? 'bg-amber-50 dark:bg-amber-950 border-l-4 border-l-amber-500'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent'
          }
          ${isHidden ? 'opacity-50' : ''}
          ${isDragging ? 'opacity-50 bg-zinc-100 dark:bg-zinc-800' : ''}
          ${isDropAbove ? 'border-t-2 border-t-amber-500' : ''}
          ${isDropBelow ? 'border-b-2 border-b-amber-500' : ''}
        `}
        role="treeitem"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        aria-selected={isAllSelected}
        aria-label={`Group: ${displayName} (${groupElements.length} elements)${isHidden ? ', hidden' : ''}${isLocked ? ', locked' : ''}`}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleGroupCollapse(group.id);
          }}
          className="flex-shrink-0 p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Group icon */}
        <div className="flex-shrink-0 text-amber-500 dark:text-amber-400">
          <Folder size={16} />
        </div>

        {/* Group name (editable) */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={groupInputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-sm px-1 py-0.5 border border-amber-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label="Edit group name"
            />
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-1 text-left text-sm text-zinc-700 dark:text-zinc-300 truncate hover:text-amber-600 dark:hover:text-amber-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded px-1 -mx-1 group/name"
              onDoubleClick={(e) => startEditingGroup(group, groupElements, e)}
              title={`${displayName} (double-click to rename)`}
            >
              <span className="truncate font-medium">{displayName}</span>
              <span className="flex-shrink-0 text-xs text-zinc-400 dark:text-zinc-500 ml-1">
                {groupElements.length}
              </span>
              <PencilLine
                size={12}
                className="flex-shrink-0 opacity-0 group-hover/name:opacity-60 transition-opacity"
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleGroupVisibility(group.id);
          }}
          className={`
            flex-shrink-0 p-1 rounded transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            ${isHidden
              ? 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }
          `}
          title={isHidden ? 'Show group' : 'Hide group'}
          aria-label={isHidden ? 'Show group' : 'Hide group'}
          aria-pressed={!isHidden}
        >
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        {/* Lock toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleGroupLock(group.id);
          }}
          className={`
            flex-shrink-0 p-1 rounded transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            ${isLocked
              ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }
          `}
          title={isLocked ? 'Unlock group' : 'Lock group'}
          aria-label={isLocked ? 'Unlock group' : 'Lock group'}
          aria-pressed={isLocked}
        >
          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
      </div>
    );
  };

  // Count groups
  const groupCount = componentGroups.length + elementGroups.length;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col h-full transition-all duration-200 motion-reduce:transition-none overflow-hidden ${
        isExpanded ? 'w-64' : 'w-0 border-l-0'
      }`}
      role="region"
      aria-label="Layers panel"
    >
      {/* Content only visible after opening animation completes / before closing animation starts */}
      {contentVisible && (
        <>
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-zinc-600 dark:text-zinc-400" />
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Layers</h2>
            </div>
            <button
              onClick={onToggle}
              className="w-8 h-8 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              title="Hide panel"
              aria-label="Hide layers panel"
              aria-expanded="true"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Element count */}
          <div className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            {elements.length} {elements.length === 1 ? 'element' : 'elements'}
            {groupCount > 0 && (
              <span className="ml-2">
                · {groupCount} {groupCount === 1 ? 'group' : 'groups'}
              </span>
            )}
            {componentInstances.length > 0 && (
              <span className="ml-2">
                · {componentInstances.length} {componentInstances.length === 1 ? 'instance' : 'instances'}
              </span>
            )}
          </div>

          {/* Search/filter input */}
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or type..."
                className="w-full pl-8 pr-7 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-md text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                aria-label="Filter layers"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Layer list */}
          <div
            className="flex-1 overflow-y-auto"
            role="tree"
            aria-label="Element layers"
          >
        {layerItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No elements yet
          </div>
        ) : filteredLayerItems.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No matches for &quot;{searchQuery}&quot;
          </div>
        ) : (
          <>
            {filteredLayerItems.map((item, idx) => {
              if (item.type === 'element') {
                return renderElementRow(item.element, item.displayIndex, false);
              }

              if (item.type === 'componentGroup') {
                const { group, elements: groupElements } = item;
                const isCollapsed = collapsedGroups.has(group.id);
                const isAllSelected = groupElements.every(el =>
                  el.id === selectedElementId || selectedElementIds.has(el.id)
                );
                const groupName = group.componentType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                return (
                  <div key={group.id} role="group">
                    {renderComponentGroupHeader(group.id, groupName, groupElements.length, isAllSelected)}
                    {!isCollapsed && groupElements.map((el, elIdx) =>
                      renderElementRow(el, idx * 100 + elIdx, true)
                    )}
                  </div>
                );
              }

              if (item.type === 'elementGroup') {
                const { group, elements: groupElements } = item;
                const isCollapsed = collapsedGroups.has(group.id);
                const isAllSelected = groupElements.every(el =>
                  el.id === selectedElementId || selectedElementIds.has(el.id)
                );
                // Find the index of this group within elementGroups for drag-drop
                const groupIndex = elementGroups.findIndex(g => g.id === group.id);

                return (
                  <div key={group.id} role="group">
                    {renderElementGroupRow(group, groupElements, groupIndex, isAllSelected)}
                    {!isCollapsed && groupElements.map((el, elIdx) =>
                      renderElementRow(el, idx * 100 + elIdx, true)
                    )}
                  </div>
                );
              }

              if (item.type === 'userComponentInstance') {
                const { instance, component, instanceIndex } = item;
                const isSelected = instance.id === selectedInstanceId;
                const isOrphaned = !component;
                const isEditing = instance.id === editingId && editingType === 'instance';
                const isHidden = instance.visible === false;
                const isLocked = instance.locked === true;
                const isDragging = instanceIndex === draggedInstanceIndex;
                const isDropTarget = instanceIndex === dropInstanceTargetIndex && draggedInstanceIndex !== null && instanceIndex !== draggedInstanceIndex;
                const isDropAbove = isDropTarget && dropInstancePosition === 'above';
                const isDropBelow = isDropTarget && dropInstancePosition === 'below';
                const displayName = getInstanceDisplayName(instance, component);

                return (
                  <div
                    key={instance.id}
                    draggable={!isEditing}
                    onDragStart={handleInstanceDragStart(instanceIndex)}
                    onDragOver={handleInstanceDragOver(instanceIndex)}
                    onDragLeave={handleInstanceDragLeave}
                    onDrop={handleInstanceDrop(instanceIndex)}
                    onDragEnd={handleInstanceDragEnd}
                    onClick={() => !isEditing && onSelectInstance(instance.id)}
                    className={`
                      group flex items-center gap-2 px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800
                      transition-all duration-150 cursor-pointer
                      ${isSelected
                        ? 'bg-purple-50 dark:bg-purple-950 border-l-4 border-l-purple-500'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent'
                      }
                      ${isOrphaned ? 'opacity-70' : ''}
                      ${isHidden ? 'opacity-50' : ''}
                      ${isDragging ? 'opacity-50 bg-zinc-100 dark:bg-zinc-800' : ''}
                      ${isDropAbove ? 'border-t-2 border-t-purple-500' : ''}
                      ${isDropBelow ? 'border-b-2 border-b-purple-500' : ''}
                    `}
                    role="treeitem"
                    tabIndex={0}
                    aria-selected={isSelected}
                    aria-label={`Component instance: ${displayName}${isOrphaned ? ' (orphaned)' : ''}${isHidden ? ', hidden' : ''}${isLocked ? ', locked' : ''}`}
                  >
                    {/* Drag handle */}
                    <div
                      className="flex-shrink-0 cursor-grab active:cursor-grabbing text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Drag to reorder"
                    >
                      <GripVertical size={14} />
                    </div>

                    {/* Component icon */}
                    <div className={`flex-shrink-0 ${isOrphaned ? 'text-amber-500 dark:text-amber-400' : 'text-purple-500 dark:text-purple-400'}`}>
                      {isOrphaned ? <AlertTriangle size={16} /> : <Component size={16} />}
                    </div>

                    {/* Instance name (editable) */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          ref={instanceInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm px-1 py-0.5 border border-purple-500 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                          aria-label="Edit instance name"
                        />
                      ) : (
                        <button
                          type="button"
                          className="w-full flex items-center gap-1 text-left text-sm text-zinc-700 dark:text-zinc-300 truncate hover:text-purple-600 dark:hover:text-purple-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1 -mx-1 group/name"
                          onDoubleClick={(e) => startEditingInstance(instance, component, e)}
                          title={`${displayName} (double-click to rename)`}
                        >
                          <span className={`truncate ${isOrphaned ? 'italic' : 'font-medium'}`}>{displayName}</span>
                          {isOrphaned && (
                            <span className="flex-shrink-0 text-xs text-amber-500 dark:text-amber-400">
                              (deleted)
                            </span>
                          )}
                          <PencilLine
                            size={12}
                            className="flex-shrink-0 opacity-0 group-hover/name:opacity-60 transition-opacity"
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>

                    {/* Visibility toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleInstanceVisibility(instance.id);
                      }}
                      className={`
                        flex-shrink-0 p-1 rounded transition-all duration-150
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
                        ${isHidden
                          ? 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }
                      `}
                      title={isHidden ? 'Show instance' : 'Hide instance'}
                      aria-label={isHidden ? 'Show instance' : 'Hide instance'}
                      aria-pressed={!isHidden}
                    >
                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Lock toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleInstanceLock(instance.id);
                      }}
                      className={`
                        flex-shrink-0 p-1 rounded transition-all duration-150
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
                        ${isLocked
                          ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }
                      `}
                      title={isLocked ? 'Unlock instance' : 'Lock instance'}
                      aria-label={isLocked ? 'Unlock instance' : 'Lock instance'}
                      aria-pressed={isLocked}
                    >
                      {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                  </div>
                );
              }

              return null;
            })}
            {/* Bottom drop zone for moving to the end of the list */}
            {draggedIndex !== null && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropTargetIndex(elements.length);
                  setDropPosition('below');
                }}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop(elements.length, 'below')}
                className={`
                  h-8 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500
                  transition-all duration-150
                  ${dropTargetIndex === elements.length ? 'bg-blue-50 dark:bg-blue-950 border-t-2 border-t-blue-500' : ''}
                `}
              >
                {dropTargetIndex === elements.length ? 'Drop here to move to bottom' : ''}
              </div>
            )}
          </>
        )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-medium">Double-click</span> to rename · <span className="font-medium">H</span> visibility · <span className="font-medium">Ctrl+L</span> lock
          </div>
        </>
      )}
    </div>
  );
}

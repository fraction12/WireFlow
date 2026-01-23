"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Undo2, Redo2 } from "lucide-react";
import type {
  CanvasElement,
  Tool,
  RectangleElement,
  EllipseElement,
  DiamondElement,
  TextElement,
  ArrowElement,
  LineElement,
  FreedrawElement,
  Frame,
  FrameType,
  ComponentGroup,
  ComponentTemplate,
  ElementGroup,
  UserComponent,
  ComponentInstance,
  ComponentElementDef,
  ComponentOverride,
  FrameDocumentation,
  ElementAnnotation,
  ElementStyle,
  BoundElement,
} from "@/lib/types";
import { saveWorkspace, loadWorkspace, type SaveResult } from "@/lib/persistence";
import {
  MIN_TEXT_WIDTH,
  TEXT_PADDING,
  calculateAutoWidth,
} from "@/lib/textMeasurement";
import { useHistoryManager } from "@/lib/useHistory";
import { Toolbar, useToast } from "./ui";
import { ExportButton } from "./ExportButton";
import {
  ComponentPanel,
  DocumentationPanel,
  FrameList,
  LayersPanel,
  RightPanelStrip,
  UnifiedStyleBar,
} from "./panels";
import {
  ConfirmDialog,
  ImageExport,
  KeyboardShortcutsPanel,
  WelcomeModal,
} from "./dialogs";
import { ThemeToggle } from "./theme";
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_FILL_COLOR,
  ALIGNMENT_GUIDE_COLOR,
  SNAP_GUIDE_COLOR,
  LOCK_BADGE_BG_COLOR,
  LOCK_BADGE_ICON_COLOR,
  TAGGED_ELEMENT_BG_COLOR,
} from "@/lib/colors";
import { useMCPBridge, type MCPBridgeCallbacks } from "@/lib/mcpBridge";
import { COMPONENT_TEMPLATES } from "@/lib/componentTemplates";
import {
  // Constants
  ARROW_HEAD_LENGTH,
  HANDLE_SIZE,
  HANDLE_TOLERANCE,
  MIN_ELEMENT_SIZE,
  MIN_DRAG_DISTANCE,
  DEFAULT_CLICK_SHAPE_SIZE,
  ROTATION_HANDLE_OFFSET,
  SELECTION_PADDING,
  GROUP_SELECTION_PADDING,
  MULTI_SELECT_PADDING,
  SELECTION_DASH_PATTERN,
  GROUP_DASH_PATTERN,
  MULTI_SELECT_DASH_PATTERN,
  ELEMENT_GROUP_DASH_PATTERN,
  SELECTION_LINE_WIDTH,
  GROUP_LINE_WIDTH,
  MULTI_SELECT_LINE_WIDTH,
  ELEMENT_GROUP_LINE_WIDTH,
  getCanvasTheme,
  type CanvasTheme,
  // Renderers
  getRandomOffset,
  drawSketchLine,
  drawSketchRect,
  drawSketchEllipse,
  drawSketchDiamond,
  drawFreedraw,
  wrapText,
  // Utilities
  generateId,
  generateFrameId,
  isContainerElement,
  getBoundTextElement,
  calculateTextBoundsForContainer,
  syncBoundTextPosition,
  createBoundTextElement,
} from "./canvas-core";

// Snapshot type for undo/redo history
interface HistorySnapshot {
  frames: Frame[];
  componentGroups: ComponentGroup[];
  elementGroups: ElementGroup[];
  userComponents: UserComponent[];
  componentInstances: ComponentInstance[];
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>(getCanvasTheme);
  const { addToast } = useToast();

  // Animation frame request ref for throttling redraws
  const rafIdRef = useRef<number | null>(null);
  const needsRedrawRef = useRef(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "default";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "default",
    onConfirm: () => {},
  });

  const showConfirmDialog = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    variant: "danger" | "warning" | "default" = "danger",
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      variant,
      onConfirm,
    });
  }, []);

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // State for promote to component dialog
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [pendingPromoteGroupId, setPendingPromoteGroupId] = useState<string | null>(null);
  const [newComponentName, setNewComponentName] = useState('');

  // Lock body scroll when promote dialog is open
  useEffect(() => {
    if (isPromoteDialogOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isPromoteDialogOpen]);

  // Constants, renderers, and utilities are imported from ./canvas-core

  // Initialize with default frame
  const defaultFrame: Frame = {
    id: generateFrameId(),
    name: "Page 1",
    type: "page",
    elements: [],
    createdAt: new Date().toISOString(),
  };

  // Frame state
  const [frames, setFrames] = useState<Frame[]>([defaultFrame]);
  const [activeFrameId, setActiveFrameId] = useState<string>(defaultFrame.id);

  // Computed: Get active frame and its elements
  const activeFrame = frames.find((f) => f.id === activeFrameId);
  const elements = activeFrame?.elements || [];

  // Wrapper to update active frame's elements
  // Uses functional update to avoid stale closure issues with frames
  const setElements = (
    newElements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[]),
  ) => {
    setFrames((prevFrames) => {
      // Find the current active frame to get its elements
      const currentFrame = prevFrames.find((f) => f.id === activeFrameId);
      const currentElements = currentFrame?.elements || [];

      const elementsArray =
        typeof newElements === "function" ? newElements(currentElements) : newElements;

      return prevFrames.map((frame) =>
        frame.id === activeFrameId
          ? { ...frame, elements: elementsArray }
          : frame,
      );
    });
  };

  // Tool and interaction state
  const [currentTool, setCurrentTool] = useState<Tool>("select");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStart, setRotationStart] = useState<{
    initialAngle: number;
    elementCenterX: number;
    elementCenterY: number;
    startMouseAngle: number;
  } | null>(null);

  // Resize snapshot: captures initial element bounds and pointer origin at resize start.
  // This prevents cumulative drift by computing new bounds from a fixed reference point.
  // For arrows, also captures initial endpoints for length/direction control.
  const [resizeSnapshot, setResizeSnapshot] = useState<{
    initialBounds: { x: number; y: number; width: number; height: number };
    pointerOrigin: { x: number; y: number };
    arrowEndpoints?: {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    };
  } | null>(null);

  // Component grouping state
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // User-created element groups state
  const [elementGroups, setElementGroups] = useState<ElementGroup[]>([]);

  // User-defined components state (component library)
  const [userComponents, setUserComponents] = useState<UserComponent[]>([]);

  // Component instances state (placed instances across all frames)
  const [componentInstances, setComponentInstances] = useState<ComponentInstance[]>([]);

  // Selected instance state
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Undo/Redo history manager
  const historyManager = useHistoryManager<HistorySnapshot>(100);

  // Record a snapshot for undo (call before making changes)
  const recordSnapshot = useCallback(() => {
    historyManager.recordSnapshot({
      frames: structuredClone(frames),
      componentGroups: structuredClone(componentGroups),
      elementGroups: structuredClone(elementGroups),
      userComponents: structuredClone(userComponents),
      componentInstances: structuredClone(componentInstances),
    });
  }, [frames, componentGroups, elementGroups, userComponents, componentInstances, historyManager]);

  // Perform undo
  const performUndo = useCallback(() => {
    const currentState: HistorySnapshot = {
      frames: structuredClone(frames),
      componentGroups: structuredClone(componentGroups),
      elementGroups: structuredClone(elementGroups),
      userComponents: structuredClone(userComponents),
      componentInstances: structuredClone(componentInstances),
    };
    const previousState = historyManager.undo(currentState);
    if (previousState) {
      setFrames(previousState.frames);
      setComponentGroups(previousState.componentGroups);
      setElementGroups(previousState.elementGroups);
      setUserComponents(previousState.userComponents || []);
      setComponentInstances(previousState.componentInstances || []);
      // Clear selections after undo for safety
      setSelectedElementId(null);
      setSelectedElementIds(new Set());
      setSelectedGroupId(null);
      setSelectedInstanceId(null);
      // Show toast with remaining steps
      const remaining = historyManager.undoCount;
      addToast({
        type: 'info',
        title: 'Undo',
        message: remaining > 0 ? `${remaining} step${remaining === 1 ? '' : 's'} remaining` : 'Nothing more to undo',
        duration: 2000,
      });
    } else {
      addToast({ type: 'info', title: 'Nothing to undo', duration: 2000 });
    }
  }, [frames, componentGroups, elementGroups, userComponents, componentInstances, historyManager, addToast]);

  // Perform redo
  const performRedo = useCallback(() => {
    const currentState: HistorySnapshot = {
      frames: structuredClone(frames),
      componentGroups: structuredClone(componentGroups),
      elementGroups: structuredClone(elementGroups),
      userComponents: structuredClone(userComponents),
      componentInstances: structuredClone(componentInstances),
    };
    const nextState = historyManager.redo(currentState);
    if (nextState) {
      setFrames(nextState.frames);
      setComponentGroups(nextState.componentGroups);
      setElementGroups(nextState.elementGroups);
      setUserComponents(nextState.userComponents || []);
      setComponentInstances(nextState.componentInstances || []);
      // Clear selections after redo for safety
      setSelectedElementId(null);
      setSelectedElementIds(new Set());
      setSelectedGroupId(null);
      setSelectedInstanceId(null);
      // Show toast with remaining steps
      const remaining = historyManager.redoCount;
      addToast({
        type: 'info',
        title: 'Redo',
        message: remaining > 0 ? `${remaining} step${remaining === 1 ? '' : 's'} remaining` : 'Nothing more to redo',
        duration: 2000,
      });
    } else {
      addToast({ type: 'info', title: 'Nothing to redo', duration: 2000 });
    }
  }, [frames, componentGroups, elementGroups, userComponents, componentInstances, historyManager, addToast]);

  // Multi-selection state: holds IDs of all currently selected elements
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(
    new Set(),
  );

  // Text editing state: tracks inline editing of text elements
  // - editingElementId: which text element is currently being edited (null = not editing)
  // - editingText: current text value during editing
  // - isNewTextElement: true if this is a newly created text element (for delete-if-empty behavior)
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isNewTextElement, setIsNewTextElement] = useState(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const textFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup text focus timeout on unmount
  useEffect(() => {
    return () => {
      if (textFocusTimeoutRef.current) {
        clearTimeout(textFocusTimeoutRef.current);
      }
    };
  }, []);

  // Marquee (area) selection state
  // - isMarqueeSelecting: true when user is dragging to create selection box
  // - marqueeStart: starting corner of the selection rectangle
  // - marqueeEnd: current corner of the selection rectangle (during drag)
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);

  // Zoom and Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false); // Track spacebar for Space+drag panning

  // Freehand drawing state
  const [freedrawPoints, setFreedrawPoints] = useState<{ x: number; y: number }[]>([]);

  // Grid and snap settings
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const GRID_SIZE = 20; // Grid cell size in pixels

  // Save status for user feedback
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Screen reader announcements for canvas operations
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>('');

  // Helper function to announce to screen readers
  const announce = useCallback((message: string) => {
    setScreenReaderAnnouncement(''); // Clear first to ensure re-announcement of same text
    requestAnimationFrame(() => {
      setScreenReaderAnnouncement(message);
    });
  }, []);

  // Keyboard shortcuts help panel state
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Welcome modal state (for manual re-opening)
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Alignment guides state (lines to show when elements align)
  const [alignmentGuides, setAlignmentGuides] = useState<{ type: 'h' | 'v'; pos: number }[]>([]);

  // Grid snap guides state (lines to show when snapping to grid)
  const [snapGuides, setSnapGuides] = useState<{ type: 'h' | 'v'; pos: number }[]>([]);

  // Right panel states (Phase 1) - only one panel can be open at a time
  // Right panels state - only one can be open at a time
  const [componentPanelExpanded, setComponentPanelExpanded] = useState(true);
  const [docPanelExpanded, setDocPanelExpanded] = useState(false);
  const [layersPanelExpanded, setLayersPanelExpanded] = useState(false);

  // Toggle handlers that ensure only one right panel is open at a time
  const toggleComponentPanel = useCallback(() => {
    setComponentPanelExpanded(prev => {
      const newState = !prev;
      if (newState) {
        setDocPanelExpanded(false);
        setLayersPanelExpanded(false);
      }
      return newState;
    });
  }, []);

  const toggleDocPanel = useCallback(() => {
    setDocPanelExpanded(prev => {
      const newState = !prev;
      if (newState) {
        setComponentPanelExpanded(false);
        setLayersPanelExpanded(false);
      }
      return newState;
    });
  }, []);

  const toggleLayersPanel = useCallback(() => {
    setLayersPanelExpanded(prev => {
      const newState = !prev;
      if (newState) {
        setComponentPanelExpanded(false);
        setDocPanelExpanded(false);
      }
      return newState;
    });
  }, []);

  // Left panels state
  const [frameListExpanded, setFrameListExpanded] = useState(true);

  const toggleFrameList = useCallback(() => {
    setFrameListExpanded(prev => !prev);
  }, []);

  // Layers panel handlers
  const toggleElementVisibility = useCallback((elementId: string) => {
    recordSnapshot();
    setElements(prev => prev.map(el =>
      el.id === elementId
        ? { ...el, visible: el.visible === false ? true : false }
        : el
    ));
  }, [recordSnapshot]);

  const toggleElementLock = useCallback((elementId: string) => {
    recordSnapshot();
    setElements(prev => prev.map(el =>
      el.id === elementId
        ? { ...el, locked: !el.locked }
        : el
    ));
  }, [recordSnapshot]);

  const renameElement = useCallback((elementId: string, newName: string) => {
    recordSnapshot();
    setElements(prev => prev.map(el =>
      el.id === elementId
        ? { ...el, name: newName.trim() || undefined }
        : el
    ));
  }, [recordSnapshot]);

  const reorderElement = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    recordSnapshot();
    setElements(prev => {
      const newElements = [...prev];
      const [removed] = newElements.splice(fromIndex, 1);
      newElements.splice(toIndex, 0, removed);
      return newElements;
    });
  }, [recordSnapshot]);

  // Colors state (Phase 1)
  const [currentStrokeColor, setCurrentStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [currentFillColor, setCurrentFillColor] = useState(DEFAULT_FILL_COLOR);
  const [strokePickerOpen, setStrokePickerOpen] = useState(false);
  const [fillPickerOpen, setFillPickerOpen] = useState(false);

  // Close color pickers when selection changes
  useEffect(() => {
    setStrokePickerOpen(false);
    setFillPickerOpen(false);
  }, [selectedElementId]);

  // Zoom constraints
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.1;

  // Convert screen coordinates to canvas coordinates (accounting for zoom and pan)
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [zoom, pan]
  );

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } => {
      return {
        x: canvasX * zoom + pan.x,
        y: canvasY * zoom + pan.y,
      };
    },
    [zoom, pan]
  );

  // Zoom functions
  const zoomIn = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.min(prev + ZOOM_STEP, MAX_ZOOM);
      if (newZoom !== prev) {
        announce(`Zoom ${Math.round(newZoom * 100)}%`);
      }
      return newZoom;
    });
  }, [announce]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, MIN_ZOOM);
      if (newZoom !== prev) {
        announce(`Zoom ${Math.round(newZoom * 100)}%`);
      }
      return newZoom;
    });
  }, [announce]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    announce('Zoom reset to 100%');
  }, [announce]);

  // Zoom to a specific point (for scroll wheel zoom)
  const zoomAtPoint = useCallback(
    (delta: number, screenX: number, screenY: number) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
      if (newZoom === zoom) return;

      // Calculate the point in canvas coordinates before zoom
      const canvasPoint = screenToCanvas(screenX, screenY);

      // After zoom, we want the same canvas point to be at the same screen position
      // newScreenX = canvasX * newZoom + newPanX
      // We want: screenX = canvasX * newZoom + newPanX
      // So: newPanX = screenX - canvasX * newZoom
      const newPanX = screenX - canvasPoint.x * newZoom;
      const newPanY = screenY - canvasPoint.y * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, screenToCanvas]
  );

  // Tracks whether initial localStorage load has completed.
  // Prevents auto-save from running before workspace data is loaded,
  // which would overwrite saved data with empty initial state.
  const isPersistenceInitialized = useRef(false);

  // Ref for keyboard handler state - prevents excessive event listener re-registration
  // by allowing the handler to read current values without being in the dependency array
  const keyboardStateRef = useRef<{
    selectedElementId: string | null;
    selectedElementIds: Set<string>;
    selectedInstanceId: string | null;
    elements: CanvasElement[];
    componentGroups: ComponentGroup[];
    elementGroups: ElementGroup[];
    editingElementId: string | null;
    isPromoteDialogOpen: boolean;
    confirmDialogIsOpen: boolean;
    showGrid: boolean;
    snapToGrid: boolean;
  }>({
    selectedElementId: null,
    selectedElementIds: new Set(),
    selectedInstanceId: null,
    elements: [],
    componentGroups: [],
    elementGroups: [],
    editingElementId: null,
    isPromoteDialogOpen: false,
    confirmDialogIsOpen: false,
    showGrid: false,
    snapToGrid: false,
  });

  // Ref for keyboard handler callbacks - prevents dependency array changes
  // All callbacks are stored in this ref and updated synchronously
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyboardCallbacksRef = useRef<Record<string, (...args: any[]) => void>>({});

  // Keep keyboard state ref in sync with current state
  // This allows the keyboard handler to access current values without re-registering
  useEffect(() => {
    keyboardStateRef.current = {
      selectedElementId,
      selectedElementIds,
      selectedInstanceId,
      elements,
      componentGroups,
      elementGroups,
      editingElementId,
      isPromoteDialogOpen,
      confirmDialogIsOpen: confirmDialog.isOpen,
      showGrid,
      snapToGrid,
    };
  }, [
    selectedElementId,
    selectedElementIds,
    selectedInstanceId,
    elements,
    componentGroups,
    elementGroups,
    editingElementId,
    isPromoteDialogOpen,
    confirmDialog.isOpen,
    showGrid,
    snapToGrid,
  ]);

  // Listen for theme changes (class-based toggle or system preference)
  useEffect(() => {
    const updateTheme = () => {
      // Small delay to ensure CSS variables have been applied
      requestAnimationFrame(() => {
        setCanvasTheme(getCanvasTheme());
      });
    };

    // Update on initial load
    updateTheme();

    // Listen for system color scheme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateTheme);

    // Listen for class changes on document element (for manual toggle)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          updateTheme();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      mediaQuery.removeEventListener("change", updateTheme);
      observer.disconnect();
    };
  }, []);

  // Track canvas container rect for toolbar positioning
  useEffect(() => {
    const updateRect = () => {
      if (canvasContainerRef.current) {
        setCanvasRect(canvasContainerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, []);

  // Load workspace from localStorage on mount
  useEffect(() => {
    if (isPersistenceInitialized.current) return;
    isPersistenceInitialized.current = true;

    const savedState = loadWorkspace();
    if (savedState && savedState.frames.length > 0) {
      setFrames(savedState.frames);
      setComponentGroups(savedState.componentGroups);
      setElementGroups(savedState.elementGroups || []);

      const loadedComponents = savedState.userComponents || [];
      setUserComponents(loadedComponents);

      // Clean up orphaned component instances (instances referencing deleted components)
      const validComponentIds = new Set(loadedComponents.map(c => c.id));
      const loadedInstances = savedState.componentInstances || [];
      const validInstances = loadedInstances.filter(
        instance => validComponentIds.has(instance.componentId)
      );
      setComponentInstances(validInstances);

      // Notify user if any orphaned instances were cleaned up
      const orphanCount = loadedInstances.length - validInstances.length;
      if (orphanCount > 0) {
        console.warn(`Cleaned up ${orphanCount} orphaned component instance(s)`);
        addToast({
          type: 'info',
          title: 'Cleanup Notice',
          message: `Removed ${orphanCount} orphaned component instance${orphanCount === 1 ? '' : 's'} (source component${orphanCount === 1 ? ' was' : 's were'} deleted)`,
          duration: 5000,
        });
      }

      // Restore active frame, or fall back to first frame if saved frame no longer exists
      const frameExists = savedState.frames.some(
        (f) => f.id === savedState.activeFrameId,
      );
      setActiveFrameId(
        frameExists ? savedState.activeFrameId : savedState.frames[0].id,
      );
    }
  }, []);

  // Auto-save workspace on meaningful state changes (debounced)
  useEffect(() => {
    // Skip saving until initial load completes
    if (!isPersistenceInitialized.current) return;

    // Show saving indicator
    setSaveStatus('saving');

    // Clear any pending status timeout
    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current);
    }

    const timeoutId = setTimeout(() => {
      const result = saveWorkspace({
        version: 1,
        frames,
        componentGroups,
        elementGroups,
        userComponents,
        componentInstances,
        activeFrameId,
      });

      if (result.success) {
        setSaveStatus('saved');
        setSaveError(null);
        // Clear saved indicator after 2 seconds
        saveStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus(null);
        }, 2000);
      } else {
        setSaveStatus('error');
        setSaveError(result.message);
        // Show error toast for all persistence errors
        addToast({ type: 'error', title: 'Save Failed', message: result.message });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [frames, componentGroups, elementGroups, userComponents, componentInstances, activeFrameId, addToast]);

  // MCP Bridge integration - enables Claude Code to control the canvas
  const mcpBridgeCallbacks: MCPBridgeCallbacks = {
    getState: () => ({
      frames,
      activeFrameId,
      componentGroups,
      elementGroups,
      userComponents,
      componentInstances,
    }),
    getElements: () => elements,
    getSelectedElementIds: () => Array.from(selectedElementIds),
    recordSnapshot,
    setElements,
    setSelectedElementIds,
    setSelectedElementId,
    setActiveFrameId,
    addFrame: (name: string, frameType: FrameType) => {
      const newFrame: Frame = {
        id: generateFrameId(),
        name,
        type: frameType,
        elements: [],
        createdAt: new Date().toISOString(),
      };
      // Uses functional update to avoid stale closure issues
      setFrames((prevFrames) => [...prevFrames, newFrame]);
      return newFrame.id;
    },
    createComponentGroup: (templateType: string, x: number, y: number) => {
      const template = COMPONENT_TEMPLATES.find(t => t.type === templateType);
      if (!template) return null;

      recordSnapshot();

      const groupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const elementIds: string[] = [];

      const newElements: CanvasElement[] = [];
      for (const tplEl of template.elements) {
        const elId = generateId();
        elementIds.push(elId);

        const baseProps = {
          id: elId,
          x: x + tplEl.offsetX,
          y: y + tplEl.offsetY,
          width: tplEl.width,
          height: tplEl.height,
          semanticTag: tplEl.semanticTag,
          description: tplEl.description,
          groupId,
          componentType: template.type,
        };

        if (tplEl.type === "text") {
          newElements.push({
            ...baseProps,
            type: "text",
            content: tplEl.content || "Text",
            textAlign: tplEl.textAlign,
          } as TextElement);
        } else if (tplEl.type === "rectangle") {
          newElements.push({ ...baseProps, type: "rectangle" } as RectangleElement);
        } else if (tplEl.type === "ellipse") {
          newElements.push({ ...baseProps, type: "ellipse" } as EllipseElement);
        } else if (tplEl.type === "line") {
          newElements.push({
            ...baseProps,
            type: "line",
            startX: x + (tplEl.startX ?? tplEl.offsetX),
            startY: y + (tplEl.startY ?? tplEl.offsetY),
            endX: x + (tplEl.endX ?? tplEl.offsetX + tplEl.width),
            endY: y + (tplEl.endY ?? tplEl.offsetY),
          } as LineElement);
        }
      }

      setElements([...elements, ...newElements]);

      const group: ComponentGroup = {
        id: groupId,
        componentType: template.type,
        x,
        y,
        elementIds,
        createdAt: new Date().toISOString(),
      };

      setComponentGroups([...componentGroups, group]);

      return { elementIds, groupId };
    },
    generateId,
    generateFrameId,
  };

  // Initialize MCP bridge (connects to MCP server via WebSocket)
  useMCPBridge(mcpBridgeCallbacks, true);

  // Helper function to get component group elements (defined before redraw)
  const getGroupElements = useCallback(
    (groupId: string): CanvasElement[] => {
      return elements.filter((el) => el.groupId === groupId);
    },
    [elements],
  );

  // Helper function to get user-created element group elements
  const getElementGroupElements = useCallback(
    (elementGroupId: string): CanvasElement[] => {
      return elements.filter((el) => el.elementGroupId === elementGroupId);
    },
    [elements],
  );

  // Helper function to find element group by element ID
  const findElementGroupByElementId = useCallback(
    (elementId: string): ElementGroup | undefined => {
      const element = elements.find((el) => el.id === elementId);
      if (!element?.elementGroupId) return undefined;
      return elementGroups.find((g) => g.id === element.elementGroupId);
    },
    [elements, elementGroups],
  );

  // Helper function to get all element IDs in a group (for selection expansion)
  const getGroupedElementIds = useCallback(
    (elementId: string): string[] => {
      const element = elements.find((el) => el.id === elementId);
      if (!element) return [elementId];

      // Check user-created element group first
      if (element.elementGroupId) {
        const group = elementGroups.find(
          (g) => g.id === element.elementGroupId,
        );
        if (group) return group.elementIds;
      }

      // Check component group
      if (element.groupId) {
        const group = componentGroups.find((g) => g.id === element.groupId);
        if (group) return group.elementIds;
      }

      return [elementId];
    },
    [elements, elementGroups, componentGroups],
  );

  // Helper function to get normalized marquee bounds (handles any drag direction)
  const getMarqueeBounds = useCallback(() => {
    if (!marqueeStart || !marqueeEnd) return null;
    return {
      x: Math.min(marqueeStart.x, marqueeEnd.x),
      y: Math.min(marqueeStart.y, marqueeEnd.y),
      width: Math.abs(marqueeEnd.x - marqueeStart.x),
      height: Math.abs(marqueeEnd.y - marqueeStart.y),
    };
  }, [marqueeStart, marqueeEnd]);

  // Helper function to check if an element intersects with a rectangle (marquee)
  // Uses bounding box intersection - element is selected if any part overlaps
  const elementIntersectsRect = useCallback(
    (
      element: CanvasElement,
      rect: { x: number; y: number; width: number; height: number },
    ): boolean => {
      // For arrows and lines, use their bounding box
      const elLeft = element.x;
      const elRight = element.x + element.width;
      const elTop = element.y;
      const elBottom = element.y + element.height;

      const rectLeft = rect.x;
      const rectRight = rect.x + rect.width;
      const rectTop = rect.y;
      const rectBottom = rect.y + rect.height;

      // Check for intersection (not fully contained, just overlap)
      return !(
        elRight < rectLeft ||
        elLeft > rectRight ||
        elBottom < rectTop ||
        elTop > rectBottom
      );
    },
    [],
  );

  // Get all elements that intersect with the current marquee
  const getElementsInMarquee = useCallback((): string[] => {
    const bounds = getMarqueeBounds();
    if (!bounds || bounds.width < 5 || bounds.height < 5) return [];

    const intersectingIds: string[] = [];

    elements.forEach((el) => {
      if (elementIntersectsRect(el, bounds)) {
        // If element is in a group, add all group members
        if (el.elementGroupId) {
          const group = elementGroups.find((g) => g.id === el.elementGroupId);
          if (group) {
            group.elementIds.forEach((id) => {
              if (!intersectingIds.includes(id)) {
                intersectingIds.push(id);
              }
            });
          }
        } else if (el.groupId) {
          // Component group
          const group = componentGroups.find((g) => g.id === el.groupId);
          if (group) {
            group.elementIds.forEach((id) => {
              if (!intersectingIds.includes(id)) {
                intersectingIds.push(id);
              }
            });
          }
        } else {
          if (!intersectingIds.includes(el.id)) {
            intersectingIds.push(el.id);
          }
        }
      }
    });

    return intersectingIds;
  }, [
    elements,
    elementGroups,
    componentGroups,
    getMarqueeBounds,
    elementIntersectsRect,
  ]);

  // Sketch-style rendering helpers are imported from ./canvas-core

  // Attach non-passive wheel event listener for proper zoom handling
  // React wheel events are passive by default, which prevents e.preventDefault() from working
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        zoomAtPoint(delta, screenX, screenY);
      } else {
        const dx = e.deltaX;
        const dy = e.deltaY;
        setPan((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
      }
    };

    canvas.addEventListener('wheel', wheelHandler, { passive: false });
    return () => canvas.removeEventListener('wheel', wheelHandler);
  }, [zoomAtPoint]);

  // Prevent browser auto-scroll on middle mouse button
  // Must use native event listener with capture phase to intercept before browser default
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const preventMiddleClickScroll = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    // Use capture phase to intercept before browser's auto-scroll behavior
    canvas.addEventListener('mousedown', preventMiddleClickScroll, { capture: true });
    // Also prevent auxclick context menu on middle mouse
    canvas.addEventListener('auxclick', preventMiddleClickScroll);

    return () => {
      canvas.removeEventListener('mousedown', preventMiddleClickScroll, { capture: true });
      canvas.removeEventListener('auxclick', preventMiddleClickScroll);
    };
  }, []);

  // Draw all elements on canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save current state and apply zoom/pan transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = canvasTheme.grid;
      ctx.lineWidth = 0.5;

      // Calculate visible area in canvas coordinates
      const visibleLeft = -pan.x / zoom;
      const visibleTop = -pan.y / zoom;
      const visibleRight = (canvas.width - pan.x) / zoom;
      const visibleBottom = (canvas.height - pan.y) / zoom;

      // Draw vertical lines
      const startX = Math.floor(visibleLeft / GRID_SIZE) * GRID_SIZE;
      for (let x = startX; x < visibleRight; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, visibleTop);
        ctx.lineTo(x, visibleBottom);
        ctx.stroke();
      }

      // Draw horizontal lines
      const startY = Math.floor(visibleTop / GRID_SIZE) * GRID_SIZE;
      for (let y = startY; y < visibleBottom; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(visibleLeft, y);
        ctx.lineTo(visibleRight, y);
        ctx.stroke();
      }
    }

    // Track groups that have selected elements inside (to suppress group border)
    const groupsWithSelectedElements = new Set<string>();

    // Draw all elements
    elements.forEach((element) => {
      // Skip hidden elements
      if (element.visible === false) return;

      // Use element's custom colors or fall back to theme sketch color
      const elementStrokeColor = element.style?.strokeColor || canvasTheme.sketch;
      const elementFillColor = element.style?.fillColor || 'transparent';

      ctx.strokeStyle = elementStrokeColor;
      ctx.fillStyle = elementStrokeColor; // For text and other fills that use stroke color
      ctx.lineWidth = 1.5;
      ctx.font = "16px sans-serif";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Determine if element is selected (single or multi-select)
      const isSelected =
        element.id === selectedElementId || selectedElementIds.has(element.id);

      // Track if this selected element belongs to a group (to suppress group border)
      if (isSelected) {
        if (element.groupId) {
          groupsWithSelectedElements.add(element.groupId);
        }
        if (element.elementGroupId) {
          groupsWithSelectedElements.add(element.elementGroupId);
        }
      }

      // For selected elements, we keep the actual colors visible so style changes
      // are reflected in real-time. Selection is indicated via a separate outline.
      // Only override colors for semantically tagged elements.
      if (element.semanticTag) {
        ctx.strokeStyle = canvasTheme.tagged;
        ctx.fillStyle = canvasTheme.tagged;
      }

      // Store colors for shape fill (used for rectangle, ellipse, diamond)
      // Selected elements show their actual fill color with a subtle selection overlay
      const shapeFillColor = element.semanticTag ? TAGGED_ELEMENT_BG_COLOR : elementFillColor;

      // Use element ID as seed for deterministic randomness
      const seed = parseInt(element.id.split("_")[1]) || 0;

      // Apply rotation transform for rotatable elements
      const rotation = element.rotation || 0;
      const hasRotation = rotation !== 0 && element.type !== "arrow" && element.type !== "line" && element.type !== "freedraw" && element.type !== "text";

      if (hasRotation) {
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
      }

      if (element.type === "rectangle") {
        // Fill rectangle first if fill color is set
        if (shapeFillColor && shapeFillColor !== 'transparent') {
          ctx.fillStyle = shapeFillColor;
          ctx.fillRect(element.x, element.y, element.width, element.height);
        }
        // Then draw the stroke
        drawSketchRect(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          seed,
        );
        // Draw selection indicator for selected rectangle
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = SELECTION_LINE_WIDTH;
          ctx.setLineDash(SELECTION_DASH_PATTERN);
          ctx.strokeRect(
            element.x - SELECTION_PADDING,
            element.y - SELECTION_PADDING,
            element.width + SELECTION_PADDING * 2,
            element.height + SELECTION_PADDING * 2
          );
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (element.type === "ellipse") {
        // Fill ellipse first if fill color is set
        if (shapeFillColor && shapeFillColor !== 'transparent') {
          ctx.fillStyle = shapeFillColor;
          ctx.beginPath();
          ctx.ellipse(
            element.x + element.width / 2,
            element.y + element.height / 2,
            element.width / 2,
            element.height / 2,
            0, 0, Math.PI * 2
          );
          ctx.fill();
        }
        // Then draw the stroke
        drawSketchEllipse(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          seed,
        );
        // Draw selection indicator for selected ellipse
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = SELECTION_LINE_WIDTH;
          ctx.setLineDash(SELECTION_DASH_PATTERN);
          ctx.beginPath();
          ctx.ellipse(
            element.x + element.width / 2,
            element.y + element.height / 2,
            element.width / 2 + SELECTION_PADDING,
            element.height / 2 + SELECTION_PADDING,
            0, 0, Math.PI * 2
          );
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (element.type === "diamond") {
        // Fill diamond first if fill color is set
        if (shapeFillColor && shapeFillColor !== 'transparent') {
          ctx.fillStyle = shapeFillColor;
          const cx = element.x + element.width / 2;
          const cy = element.y + element.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx, element.y); // Top
          ctx.lineTo(element.x + element.width, cy); // Right
          ctx.lineTo(cx, element.y + element.height); // Bottom
          ctx.lineTo(element.x, cy); // Left
          ctx.closePath();
          ctx.fill();
        }
        // Then draw the stroke
        drawSketchDiamond(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          seed,
        );
        // Draw selection indicator for selected diamond
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = SELECTION_LINE_WIDTH;
          ctx.setLineDash(SELECTION_DASH_PATTERN);
          const cx = element.x + element.width / 2;
          const cy = element.y + element.height / 2;
          ctx.beginPath();
          ctx.moveTo(cx, element.y - SELECTION_PADDING);
          ctx.lineTo(element.x + element.width + SELECTION_PADDING, cy);
          ctx.lineTo(cx, element.y + element.height + SELECTION_PADDING);
          ctx.lineTo(element.x - SELECTION_PADDING, cy);
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (element.type === "text") {
        const textEl = element as TextElement;
        const padding = TEXT_PADDING;
        const isBoundText = !!textEl.containerId;

        const isBeingEdited = element.id === editingElementId;

        // Skip rendering entirely when being edited - textarea overlay handles it
        // This prevents double-rendering (WYSIWYG)
        if (isBeingEdited) {
          return; // Skip to next element
        }

        // Get typography properties with defaults
        const fontSize = textEl.fontSize || 16;
        const fontWeight = textEl.fontWeight || "normal";
        const fontStyle = textEl.fontStyle || "normal";
        const textAlign = textEl.textAlign || "left";
        const lineHeight = textEl.lineHeight || Math.round(fontSize * 1.5);

        // Build font string: [style] [weight] size family
        const fontString = `${fontStyle === "italic" ? "italic " : ""}${fontWeight === "bold" ? "bold " : ""}${fontSize}px sans-serif`;
        ctx.font = fontString;
        ctx.textAlign = textAlign;

        const maxWidth = element.width - padding * 2;
        // Use empty string display for empty content (will show nothing)
        const lines = wrapText(ctx, textEl.content || "", maxWidth);

        // Draw subtle background for selected text elements (not bound text)
        if (isSelected && !isBoundText) {
          ctx.fillStyle = canvasTheme.selectedBg;
          ctx.fillRect(element.x, element.y, element.width, element.height);
        }

        // Use element's stroke color for text fill (so style changes are visible in real-time)
        ctx.fillStyle = elementStrokeColor;

        // Calculate x position based on alignment
        let textX: number;
        switch (textAlign) {
          case "center":
            textX = element.x + element.width / 2;
            break;
          case "right":
            textX = element.x + element.width - padding;
            break;
          default: // 'left'
            textX = element.x + padding;
        }

        // For bound text with vertical centering, calculate Y offset
        let textY = element.y + fontSize;
        if (isBoundText && textEl.verticalAlign === 'middle') {
          // Get the container to calculate vertical centering
          const container = elements.find(el => el.id === textEl.containerId);
          if (container) {
            const totalTextHeight = lines.length * lineHeight;
            textY = container.y + (container.height - totalTextHeight) / 2 + fontSize;
          }
        }

        // Render each line of wrapped text
        lines.forEach((line, index) => {
          ctx.fillText(line, textX, textY + index * lineHeight);
        });

        // Reset text align for other elements
        ctx.textAlign = "left";

        // Visual state handling for text border (only for non-bound text)
        if (isSelected && !isBoundText) {
          // Selected: use selected color with slightly thicker line for prominence
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = 2;
          drawSketchRect(
            ctx,
            element.x,
            element.y,
            element.width,
            element.height,
            seed,
          );
          ctx.lineWidth = 1.5; // Reset line width
        }
        // No hover border for text elements - cursor change provides sufficient feedback
      } else if (element.type === "arrow") {
        const arrowEl = element as ArrowElement;
        // Draw sketch-style arrow line
        drawSketchLine(
          ctx,
          arrowEl.startX,
          arrowEl.startY,
          arrowEl.endX,
          arrowEl.endY,
          seed,
        );

        // Draw sketch-style arrowhead
        const angle = Math.atan2(
          arrowEl.endY - arrowEl.startY,
          arrowEl.endX - arrowEl.startX,
        );

        const head1X =
          arrowEl.endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
        const head1Y =
          arrowEl.endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
        const head2X =
          arrowEl.endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
        const head2Y =
          arrowEl.endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

        drawSketchLine(
          ctx,
          arrowEl.endX,
          arrowEl.endY,
          head1X,
          head1Y,
          seed + 10,
        );
        drawSketchLine(
          ctx,
          arrowEl.endX,
          arrowEl.endY,
          head2X,
          head2Y,
          seed + 11,
        );
        // Draw selection indicator for selected arrow (highlight the line)
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = 3;
          ctx.setLineDash(SELECTION_DASH_PATTERN);
          ctx.beginPath();
          ctx.moveTo(arrowEl.startX, arrowEl.startY);
          ctx.lineTo(arrowEl.endX, arrowEl.endY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (element.type === "line") {
        // Draw sketch-style line (like arrow but without arrowhead)
        const lineEl = element as LineElement;
        drawSketchLine(
          ctx,
          lineEl.startX,
          lineEl.startY,
          lineEl.endX,
          lineEl.endY,
          seed,
        );
        // Draw selection indicator for selected line
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = 3;
          ctx.setLineDash(SELECTION_DASH_PATTERN);
          ctx.beginPath();
          ctx.moveTo(lineEl.startX, lineEl.startY);
          ctx.lineTo(lineEl.endX, lineEl.endY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (element.type === "freedraw") {
        // Draw freehand path
        const freedrawEl = element as FreedrawElement;
        drawFreedraw(ctx, freedrawEl.points);
        // Draw selection indicator for selected freedraw (bounding box)
        if (isSelected) {
          ctx.save();
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = SELECTION_LINE_WIDTH;
          ctx.setLineDash(SELECTION_DASH_PATTERN);
          ctx.strokeRect(
            element.x - SELECTION_PADDING,
            element.y - SELECTION_PADDING,
            element.width + SELECTION_PADDING * 2,
            element.height + SELECTION_PADDING * 2
          );
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Restore context if rotation was applied
      if (hasRotation) {
        ctx.restore();
      }

      // Draw resize handles for selected element (only if not grouped and single selection)
      const isInGroup = element.groupId || element.elementGroupId;
      const isSingleSelection =
        selectedElementIds.size === 0 ||
        (selectedElementIds.size === 1 && selectedElementIds.has(element.id));
      if (element.id === selectedElementId && !isInGroup && isSingleSelection) {
        ctx.fillStyle = canvasTheme.handle;
        ctx.strokeStyle = canvasTheme.handle;

        if (element.type === "arrow" || element.type === "line") {
          // Endpoint handles for arrows and lines: start and end points for length control
          const lineEl = element as ArrowElement | LineElement;
          const endpointHandles = [
            { x: lineEl.startX, y: lineEl.startY }, // Start point
            { x: lineEl.endX, y: lineEl.endY }, // End point
          ];

          endpointHandles.forEach((handle) => {
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
          });
        } else if (element.type === "text") {
          // Horizontal edge handles for text elements (east/west only)
          // These allow manual width control for text wrapping
          // Skip resize handles for bound text (text inside containers)
          const textEl = element as TextElement;
          if (!textEl.containerId) {
            const centerY = element.y + element.height / 2;
            const leftX = element.x - SELECTION_PADDING;
            const rightX = element.x + element.width + SELECTION_PADDING;

            // Draw west (left) handle
            ctx.beginPath();
            ctx.arc(leftX, centerY, HANDLE_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw east (right) handle
            ctx.beginPath();
            ctx.arc(rightX, centerY, HANDLE_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (element.type !== "freedraw") {
          // Corner handles for rectangles, ellipses, and diamonds
          // Position handles at the selection border corners (outside the element)
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;
          const elemRotation = element.rotation || 0;

          // Transform corner handles based on element rotation
          // Add SELECTION_PADDING to position handles at selection border
          const halfWidth = element.width / 2 + SELECTION_PADDING;
          const halfHeight = element.height / 2 + SELECTION_PADDING;
          const corners = [
            { dx: -halfWidth, dy: -halfHeight }, // NW
            { dx: halfWidth, dy: -halfHeight }, // NE
            { dx: -halfWidth, dy: halfHeight }, // SW
            { dx: halfWidth, dy: halfHeight }, // SE
          ];

          corners.forEach((corner) => {
            // Apply rotation to corner offset
            const rotatedX = corner.dx * Math.cos(elemRotation) - corner.dy * Math.sin(elemRotation);
            const rotatedY = corner.dx * Math.sin(elemRotation) + corner.dy * Math.cos(elemRotation);
            const handleX = centerX + rotatedX;
            const handleY = centerY + rotatedY;

            ctx.beginPath();
            ctx.arc(handleX, handleY, HANDLE_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();
          });

          // Draw rotation handle (above the selection border, with connector line)
          const rotHandleDistFromCenter = halfHeight + ROTATION_HANDLE_OFFSET;
          const rotHandleX = centerX + Math.sin(elemRotation) * rotHandleDistFromCenter;
          const rotHandleY = centerY - Math.cos(elemRotation) * rotHandleDistFromCenter;

          // Draw connector line from top edge of selection border to rotation handle
          const topEdgeDistFromCenter = halfHeight;
          const rotatedTopX = centerX + Math.sin(elemRotation) * topEdgeDistFromCenter;
          const rotatedTopY = centerY - Math.cos(elemRotation) * topEdgeDistFromCenter;

          ctx.beginPath();
          ctx.moveTo(rotatedTopX, rotatedTopY);
          ctx.lineTo(rotHandleX, rotHandleY);
          ctx.strokeStyle = canvasTheme.handle;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Draw rotation handle circle
          ctx.beginPath();
          ctx.arc(rotHandleX, rotHandleY, HANDLE_SIZE / 2 + 1, 0, Math.PI * 2);
          ctx.fillStyle = canvasTheme.handleFill;
          ctx.fill();
          ctx.strokeStyle = canvasTheme.handle;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Draw lock icon overlay for locked selected elements
      if (element.id === selectedElementId && element.locked && isSingleSelection) {
        const lockSize = 16;
        const lockX = element.x + element.width + SELECTION_PADDING + 4;
        const lockY = element.y - SELECTION_PADDING - lockSize - 4;

        // Draw lock icon background circle
        ctx.beginPath();
        ctx.arc(lockX + lockSize / 2, lockY + lockSize / 2, lockSize / 2 + 3, 0, Math.PI * 2);
        ctx.fillStyle = LOCK_BADGE_BG_COLOR;
        ctx.fill();

        // Draw lock icon (simplified padlock shape)
        ctx.strokeStyle = LOCK_BADGE_ICON_COLOR;
        ctx.fillStyle = LOCK_BADGE_ICON_COLOR;
        ctx.lineWidth = 1.5;

        // Lock body (rounded rectangle)
        const bodyX = lockX + 3;
        const bodyY = lockY + 7;
        const bodyW = lockSize - 6;
        const bodyH = lockSize - 8;
        ctx.beginPath();
        ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 2);
        ctx.fill();

        // Lock shackle (arc on top)
        ctx.beginPath();
        ctx.arc(lockX + lockSize / 2, lockY + 7, 4, Math.PI, 0);
        ctx.stroke();
      }
    });

    // Draw component group selection outlines
    componentGroups.forEach((group) => {
      // Only show group outline if NO individual element inside is selected
      if (group.id === selectedGroupId && !groupsWithSelectedElements.has(group.id)) {
        const groupElements = getGroupElements(group.id);
        if (groupElements.length === 0) return;

        // Calculate bounding box
        let minX = Infinity,
          minY = Infinity;
        let maxX = -Infinity,
          maxY = -Infinity;

        groupElements.forEach((el) => {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        });

        // Draw group selection box with sketch style
        ctx.strokeStyle = canvasTheme.group; // Purple for component groups
        ctx.lineWidth = GROUP_LINE_WIDTH;
        ctx.setLineDash(GROUP_DASH_PATTERN); // Dashed for group outline
        const groupSeed = parseInt(group.id.split("_")[1]) || 0;
        drawSketchRect(
          ctx,
          minX - GROUP_SELECTION_PADDING,
          minY - GROUP_SELECTION_PADDING,
          maxX - minX + GROUP_SELECTION_PADDING * 2,
          maxY - minY + GROUP_SELECTION_PADDING * 2,
          groupSeed,
        );
        ctx.setLineDash([]);

        // Draw group label
        ctx.fillStyle = canvasTheme.group;
        ctx.font = "12px sans-serif";
        const label = `Component: ${group.componentType}`;
        ctx.fillText(label, minX, minY - 10);
      }
    });

    // Draw user-created element group selection outlines
    elementGroups.forEach((group) => {
      // Only show group outline when the entire group is selected as a whole,
      // not when individual elements inside are selected
      const groupElements = getElementGroupElements(group.id);
      const allGroupElementsSelected = groupElements.length > 0 &&
        groupElements.every((el) => el.id === selectedElementId || selectedElementIds.has(el.id));

      if (allGroupElementsSelected && !groupsWithSelectedElements.has(group.id) && groupElements.length > 0) {
        // Calculate bounding box
        let minX = Infinity,
          minY = Infinity;
        let maxX = -Infinity,
          maxY = -Infinity;

        groupElements.forEach((el) => {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        });

        // Draw group selection box with sketch style - teal for user element groups
        ctx.strokeStyle = canvasTheme.elementGroup;
        ctx.lineWidth = ELEMENT_GROUP_LINE_WIDTH;
        ctx.setLineDash(ELEMENT_GROUP_DASH_PATTERN); // Long dash for element groups
        const groupSeed = parseInt(group.id.split("_")[1]) || 0;
        drawSketchRect(
          ctx,
          minX - GROUP_SELECTION_PADDING,
          minY - GROUP_SELECTION_PADDING,
          maxX - minX + GROUP_SELECTION_PADDING * 2,
          maxY - minY + GROUP_SELECTION_PADDING * 2,
          groupSeed,
        );
        ctx.setLineDash([]);

        // Draw group label with teal color
        ctx.fillStyle = canvasTheme.elementGroup;
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("Group", minX, minY - 10);
      }
    });

    // Draw component instances for the current frame
    const frameInstances = componentInstances.filter(i => i.frameId === activeFrameId);
    frameInstances.forEach((instance) => {
      const component = userComponents.find(c => c.id === instance.componentId);
      if (!component) return;

      const isSelected = instance.id === selectedInstanceId;

      // Draw each element from the master definition
      component.masterElements.forEach((def) => {
        const x = instance.x + def.offsetX;
        const y = instance.y + def.offsetY;
        const seed = parseInt(def.id.split("_")[1]) || 0;

        // Use element's custom colors or fall back to theme sketch color
        const defStrokeColor = def.style?.strokeColor || canvasTheme.sketch;
        const defFillColor = def.style?.fillColor || 'transparent';

        // Set colors - selected instances still show their colors, just like regular elements
        ctx.strokeStyle = defStrokeColor;
        ctx.fillStyle = defStrokeColor; // For text and other fills that use stroke color
        ctx.lineWidth = 1.5;

        // Apply rotation if present
        const rotation = def.rotation || 0;
        const hasRotation = rotation !== 0 && def.type !== "arrow" && def.type !== "line" && def.type !== "freedraw" && def.type !== "text";

        if (hasRotation) {
          const centerX = x + def.width / 2;
          const centerY = y + def.height / 2;
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(rotation);
          ctx.translate(-centerX, -centerY);
        }

        // Draw based on element type
        if (def.type === "rectangle") {
          // Fill rectangle first if fill color is set
          if (defFillColor && defFillColor !== 'transparent') {
            ctx.fillStyle = defFillColor;
            ctx.fillRect(x, y, def.width, def.height);
          }
          drawSketchRect(ctx, x, y, def.width, def.height, seed);
        } else if (def.type === "ellipse") {
          // Fill ellipse first if fill color is set
          if (defFillColor && defFillColor !== 'transparent') {
            ctx.fillStyle = defFillColor;
            ctx.beginPath();
            ctx.ellipse(
              x + def.width / 2,
              y + def.height / 2,
              def.width / 2,
              def.height / 2,
              0, 0, Math.PI * 2
            );
            ctx.fill();
          }
          drawSketchEllipse(ctx, x, y, def.width, def.height, seed);
        } else if (def.type === "diamond") {
          // Fill diamond first if fill color is set
          if (defFillColor && defFillColor !== 'transparent') {
            ctx.fillStyle = defFillColor;
            const cx = x + def.width / 2;
            const cy = y + def.height / 2;
            ctx.beginPath();
            ctx.moveTo(cx, y); // Top
            ctx.lineTo(x + def.width, cy); // Right
            ctx.lineTo(cx, y + def.height); // Bottom
            ctx.lineTo(x, cy); // Left
            ctx.closePath();
            ctx.fill();
          }
          drawSketchDiamond(ctx, x, y, def.width, def.height, seed);
        } else if (def.type === "text") {
          // Get override for text content if any
          const override = instance.overrides?.find(o => o.elementId === def.id && o.property === 'content');
          const content = override ? String(override.value) : (def.content || '');

          const fontSize = def.fontSize || 16;
          const fontWeight = def.fontWeight || "normal";
          const fontStyle = def.fontStyle || "normal";
          const textAlign = def.textAlign || "left";
          const lineHeight = def.lineHeight || Math.round(fontSize * 1.5);

          const fontString = `${fontStyle === "italic" ? "italic " : ""}${fontWeight === "bold" ? "bold " : ""}${fontSize}px sans-serif`;
          ctx.font = fontString;
          ctx.textAlign = textAlign;

          const padding = TEXT_PADDING;
          const maxWidth = def.width - padding * 2;
          const lines = wrapText(ctx, content, maxWidth);

          // Calculate x position based on alignment
          let textX: number;
          switch (textAlign) {
            case "center":
              textX = x + def.width / 2;
              break;
            case "right":
              textX = x + def.width - padding;
              break;
            default: // 'left'
              textX = x + padding;
          }

          lines.forEach((line, index) => {
            ctx.fillText(line, textX, y + fontSize + index * lineHeight);
          });

          ctx.textAlign = "left";
        } else if (def.type === "arrow") {
          const startX = instance.x + (def.startX || 0);
          const startY = instance.y + (def.startY || 0);
          const endX = instance.x + (def.endX || 0);
          const endY = instance.y + (def.endY || 0);
          // Draw sketch-style arrow line
          drawSketchLine(ctx, startX, startY, endX, endY, seed);
          // Draw sketch-style arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const head1X = endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
          const head1Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
          const head2X = endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
          const head2Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);
          drawSketchLine(ctx, endX, endY, head1X, head1Y, seed + 10);
          drawSketchLine(ctx, endX, endY, head2X, head2Y, seed + 11);
        } else if (def.type === "line") {
          const startX = instance.x + (def.startX || 0);
          const startY = instance.y + (def.startY || 0);
          const endX = instance.x + (def.endX || 0);
          const endY = instance.y + (def.endY || 0);
          drawSketchLine(ctx, startX, startY, endX, endY, seed);
        } else if (def.type === "freedraw" && def.points) {
          const translatedPoints = def.points.map(p => ({
            x: instance.x + p.x,
            y: instance.y + p.y,
          }));
          if (translatedPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(translatedPoints[0].x, translatedPoints[0].y);
            for (let i = 1; i < translatedPoints.length; i++) {
              ctx.lineTo(translatedPoints[i].x, translatedPoints[i].y);
            }
            ctx.stroke();
          }
        }

        if (hasRotation) {
          ctx.restore();
        }
      });

      // Draw instance bounding box
      ctx.strokeStyle = isSelected ? canvasTheme.selected : canvasTheme.group;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.setLineDash([6, 3]);
      const instanceSeed = parseInt(instance.id.split("_")[1]) || 0;
      drawSketchRect(
        ctx,
        instance.x - 3,
        instance.y - 3,
        component.width + 6,
        component.height + 6,
        instanceSeed
      );
      ctx.setLineDash([]);

      // Draw component name label
      ctx.fillStyle = isSelected ? canvasTheme.selected : canvasTheme.group;
      ctx.font = "11px sans-serif";
      ctx.fillText(component.name, instance.x, instance.y - 8);

      // Note: No resize handles for component instances - they are atomic units with fixed dimensions
    });

    // Draw multi-selection bounding box (when multiple ungrouped elements are selected)
    if (selectedElementIds.size > 1) {
      const selectedElements = elements.filter((el) =>
        selectedElementIds.has(el.id),
      );
      // Only draw if we have multiple elements and they're not all in the same group
      const allInSameGroup = selectedElements.every(
        (el) =>
          el.elementGroupId &&
          el.elementGroupId === selectedElements[0]?.elementGroupId,
      );

      if (!allInSameGroup && selectedElements.length > 0) {
        let minX = Infinity,
          minY = Infinity;
        let maxX = -Infinity,
          maxY = -Infinity;

        selectedElements.forEach((el) => {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        });

        // Cyan dotted border for multi-selection (visually distinct from single/group)
        ctx.strokeStyle = canvasTheme.multiSelect;
        ctx.lineWidth = MULTI_SELECT_LINE_WIDTH;
        ctx.setLineDash(MULTI_SELECT_DASH_PATTERN);
        ctx.strokeRect(
          minX - MULTI_SELECT_PADDING,
          minY - MULTI_SELECT_PADDING,
          maxX - minX + MULTI_SELECT_PADDING * 2,
          maxY - minY + MULTI_SELECT_PADDING * 2
        );
        ctx.setLineDash([]);

        // Draw selection count label
        ctx.fillStyle = canvasTheme.multiSelect;
        ctx.font = "bold 10px sans-serif";
        ctx.fillText(`${selectedElements.length} selected`, minX - MULTI_SELECT_PADDING, minY - MULTI_SELECT_PADDING - 4);
      }
    }

    // Draw marquee selection rectangle
    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      const bounds = {
        x: Math.min(marqueeStart.x, marqueeEnd.x),
        y: Math.min(marqueeStart.y, marqueeEnd.y),
        width: Math.abs(marqueeEnd.x - marqueeStart.x),
        height: Math.abs(marqueeEnd.y - marqueeStart.y),
      };

      // Semi-transparent fill
      ctx.fillStyle = canvasTheme.marqueeFill;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

      // Dashed border
      ctx.strokeStyle = canvasTheme.marqueeStroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.setLineDash([]);
    }

    // Draw alignment guides
    if (alignmentGuides.length > 0) {
      ctx.strokeStyle = ALIGNMENT_GUIDE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const visibleLeft = -pan.x / zoom;
      const visibleTop = -pan.y / zoom;
      const visibleRight = (canvas.width - pan.x) / zoom;
      const visibleBottom = (canvas.height - pan.y) / zoom;

      alignmentGuides.forEach((guide) => {
        ctx.beginPath();
        if (guide.type === 'v') {
          ctx.moveTo(guide.pos, visibleTop);
          ctx.lineTo(guide.pos, visibleBottom);
        } else {
          ctx.moveTo(visibleLeft, guide.pos);
          ctx.lineTo(visibleRight, guide.pos);
        }
        ctx.stroke();
      });

      ctx.setLineDash([]);
    }

    // Draw snap guides (grid snap feedback)
    if (snapGuides.length > 0) {
      ctx.strokeStyle = SNAP_GUIDE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      const visibleLeft = -pan.x / zoom;
      const visibleTop = -pan.y / zoom;
      const visibleRight = (canvas.width - pan.x) / zoom;
      const visibleBottom = (canvas.height - pan.y) / zoom;

      snapGuides.forEach((guide) => {
        ctx.beginPath();
        if (guide.type === 'v') {
          ctx.moveTo(guide.pos, visibleTop);
          ctx.lineTo(guide.pos, visibleBottom);
        } else {
          ctx.moveTo(visibleLeft, guide.pos);
          ctx.lineTo(visibleRight, guide.pos);
        }
        ctx.stroke();
      });
    }

    // Restore canvas state (undo zoom/pan transform)
    ctx.restore();
  }, [
    elements,
    selectedElementId,
    selectedElementIds,
    hoveredElementId,
    editingElementId,
    currentTool,
    componentGroups,
    selectedGroupId,
    elementGroups,
    getGroupElements,
    getElementGroupElements,
    userComponents,
    componentInstances,
    selectedInstanceId,
    activeFrameId,
    isMarqueeSelecting,
    marqueeStart,
    marqueeEnd,
    canvasTheme,
    zoom,
    pan,
    alignmentGuides,
    snapGuides,
    showGrid,
    GRID_SIZE,
  ]);

  // Throttled redraw using requestAnimationFrame
  // Prevents multiple redraws in the same frame for better performance
  useEffect(() => {
    needsRedrawRef.current = true;

    const scheduleRedraw = () => {
      if (needsRedrawRef.current && !rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (needsRedrawRef.current) {
            needsRedrawRef.current = false;
            redraw();
          }
        });
      }
    };

    scheduleRedraw();

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [redraw]);

  // Find element at point
  const findElementAtPoint = (
    x: number,
    y: number,
  ): { element: CanvasElement | null; groupId?: string } => {
    // Search in reverse order (top element first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];

      // Skip hidden elements (not clickable on canvas)
      if (el.visible === false) continue;

      let isHit = false;

      if (el.type === "arrow" || el.type === "line") {
        // Point-to-line distance check for arrows and lines
        const lineEl = el as ArrowElement | LineElement;
        const dist = pointToLineDistance(
          x,
          y,
          lineEl.startX,
          lineEl.startY,
          lineEl.endX,
          lineEl.endY,
        );
        isHit = dist < 10;
      } else {
        isHit =
          x >= el.x &&
          x <= el.x + el.width &&
          y >= el.y &&
          y <= el.y + el.height;
      }

      if (isHit) {
        return {
          element: el,
          groupId: el.groupId,
        };
      }
    }
    return { element: null };
  };

  // Find component instance at point
  const findInstanceAtPoint = (
    x: number,
    y: number,
  ): ComponentInstance | null => {
    // Get instances for the current frame
    const frameInstances = componentInstances.filter(i => i.frameId === activeFrameId);

    // Search in reverse order (most recently placed first, which appears on top)
    for (let i = frameInstances.length - 1; i >= 0; i--) {
      const instance = frameInstances[i];
      const component = userComponents.find(c => c.id === instance.componentId);
      if (!component) continue;

      // Check if point is within instance bounding box
      if (
        x >= instance.x &&
        x <= instance.x + component.width &&
        y >= instance.y &&
        y <= instance.y + component.height
      ) {
        return instance;
      }
    }
    return null;
  };

  // Helper function for arrow hit detection
  const pointToLineDistance = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Check if click is on a resize handle.
  // Returns handle ID: 'nw'|'ne'|'sw'|'se' for rectangles, 'start'|'end' for arrows/lines,
  // 'e'|'w' for text elements (horizontal-only resize).
  const getResizeHandle = (
    x: number,
    y: number,
    element: CanvasElement,
  ): string | null => {
    // Text elements have horizontal resize handles (east/west) for width control
    // Skip for bound text (text inside containers) - their size is controlled by the container
    if (element.type === "text") {
      const textEl = element as TextElement;
      if (textEl.containerId) {
        return null;
      }
      const centerY = element.y + element.height / 2;
      const leftX = element.x - SELECTION_PADDING;
      const rightX = element.x + element.width + SELECTION_PADDING;

      // Check west (left) handle
      if (
        Math.abs(x - leftX) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
        Math.abs(y - centerY) <= HANDLE_SIZE + HANDLE_TOLERANCE
      ) {
        return "w";
      }
      // Check east (right) handle
      if (
        Math.abs(x - rightX) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
        Math.abs(y - centerY) <= HANDLE_SIZE + HANDLE_TOLERANCE
      ) {
        return "e";
      }
      return null;
    }

    if (element.type === "arrow" || element.type === "line") {
      // Endpoint handles for arrows and lines
      const lineEl = element as ArrowElement | LineElement;
      const endpointHandles = {
        start: { x: lineEl.startX, y: lineEl.startY },
        end: { x: lineEl.endX, y: lineEl.endY },
      };

      for (const [key, pos] of Object.entries(endpointHandles)) {
        if (
          Math.abs(x - pos.x) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
          Math.abs(y - pos.y) <= HANDLE_SIZE + HANDLE_TOLERANCE
        ) {
          return key;
        }
      }
      return null;
    }

    // Corner handles for rectangles, ellipses, and diamonds
    // Account for element rotation when calculating handle positions
    // Handles are positioned at the selection border (with SELECTION_PADDING offset)
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const rotation = element.rotation || 0;

    // Corner offsets from center (before rotation)
    // Add SELECTION_PADDING to match visual handle positions at selection border
    const halfWidth = element.width / 2 + SELECTION_PADDING;
    const halfHeight = element.height / 2 + SELECTION_PADDING;
    const corners = [
      { key: "nw", dx: -halfWidth, dy: -halfHeight },
      { key: "ne", dx: halfWidth, dy: -halfHeight },
      { key: "sw", dx: -halfWidth, dy: halfHeight },
      { key: "se", dx: halfWidth, dy: halfHeight },
    ];

    for (const corner of corners) {
      // Apply rotation transformation to get actual handle position
      const rotatedX = corner.dx * Math.cos(rotation) - corner.dy * Math.sin(rotation);
      const rotatedY = corner.dx * Math.sin(rotation) + corner.dy * Math.cos(rotation);
      const handleX = centerX + rotatedX;
      const handleY = centerY + rotatedY;

      if (
        Math.abs(x - handleX) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
        Math.abs(y - handleY) <= HANDLE_SIZE + HANDLE_TOLERANCE
      ) {
        return corner.key;
      }
    }
    return null;
  };

  // Check if click is on the rotation handle (above the element)
  const isOnRotationHandle = (
    x: number,
    y: number,
    element: CanvasElement,
  ): boolean => {
    // Text, arrow, and line elements don't have rotation handles
    if (element.type === "text" || element.type === "arrow" || element.type === "line" || element.type === "freedraw") {
      return false;
    }

    // Calculate element center and rotation handle position
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const rotation = element.rotation || 0;

    // Rotation handle is above the selection border, rotated with the element
    const handleDistFromCenter = element.height / 2 + SELECTION_PADDING + ROTATION_HANDLE_OFFSET;
    const handleX = centerX + Math.sin(rotation) * handleDistFromCenter;
    const handleY = centerY - Math.cos(rotation) * handleDistFromCenter;

    return (
      Math.abs(x - handleX) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
      Math.abs(y - handleY) <= HANDLE_SIZE + HANDLE_TOLERANCE
    );
  };

  // Get cursor style for a given handle type
  const getHandleCursor = (handle: string | null): string => {
    if (!handle) return "cursor-move";
    switch (handle) {
      case "nw":
      case "se":
        return "cursor-nwse-resize";
      case "ne":
      case "sw":
        return "cursor-nesw-resize";
      case "e":
      case "w":
        return "cursor-ew-resize";
      case "start":
      case "end":
        return "cursor-crosshair";
      case "rotation":
        return "cursor-grab";
      default:
        return "cursor-move";
    }
  };

  // Get tool-specific cursor for drawing tools
  const getToolCursor = (tool: Tool): string => {
    // Custom SVG cursors for each tool with hotspot at center (12,12) of 24x24 canvas
    const cursors: Record<string, string> = {
      rectangle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Crect x='4' y='6' width='16' height='12' stroke='%23374151' stroke-width='1.5' fill='none'/%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, crosshair`,
      ellipse: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cellipse cx='12' cy='12' rx='8' ry='6' stroke='%23374151' stroke-width='1.5' fill='none'/%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, crosshair`,
      diamond: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M12 4 L20 12 L12 20 L4 12 Z' stroke='%23374151' stroke-width='1.5' fill='none'/%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, crosshair`,
      arrow: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cline x1='4' y1='20' x2='20' y2='4' stroke='%23374151' stroke-width='1.5'/%3E%3Cpath d='M14 4 L20 4 L20 10' stroke='%23374151' stroke-width='1.5' fill='none'/%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, crosshair`,
      line: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cline x1='4' y1='20' x2='20' y2='4' stroke='%23374151' stroke-width='1.5'/%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, crosshair`,
      text: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 6 L18 6 L18 8 L13 8 L13 18 L11 18 L11 8 L6 8 Z' stroke='%23374151' stroke-width='1.5' fill='none'/%3E%3Cline x1='12' y1='0' x2='12' y2='4' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='12' y1='20' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='8' y2='12' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='16' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, text`,
      freedraw: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M4 20 Q8 12 12 14 Q16 16 20 8' stroke='%23374151' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3Cline x1='12' y1='0' x2='12' y2='24' stroke='%23374151' stroke-width='1'/%3E%3Cline x1='0' y1='12' x2='24' y2='12' stroke='%23374151' stroke-width='1'/%3E%3C/svg%3E") 12 12, crosshair`,
    };
    return cursors[tool] || 'crosshair';
  };

  // Snap coordinate to grid
  const snapToGridCoord = (value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // Constrain line/arrow endpoint to 45-degree increments (for Shift key)
  const constrainToAngle = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): { x: number; y: number } => {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Snap to nearest 45-degree increment (0, 45, 90, 135, 180, 225, 270, 315)
    const angle = Math.atan2(dy, dx);
    const snapAngle = Math.PI / 4; // 45 degrees
    const snappedAngle = Math.round(angle / snapAngle) * snapAngle;

    return {
      x: startX + distance * Math.cos(snappedAngle),
      y: startY + distance * Math.sin(snappedAngle),
    };
  };

  // Find alignment guides when moving an element
  const ALIGNMENT_TOLERANCE = 5;

  const findAlignmentGuides = (
    movingElement: CanvasElement,
    newX: number,
    newY: number
  ): { guides: { type: 'h' | 'v'; pos: number }[]; snapX: number; snapY: number } => {
    const guides: { type: 'h' | 'v'; pos: number }[] = [];
    let snapX = newX;
    let snapY = newY;

    // Key positions for the moving element
    const movingLeft = newX;
    const movingRight = newX + movingElement.width;
    const movingCenterX = newX + movingElement.width / 2;
    const movingTop = newY;
    const movingBottom = newY + movingElement.height;
    const movingCenterY = newY + movingElement.height / 2;

    elements.forEach((el) => {
      if (el.id === movingElement.id) return;
      if (el.type === "arrow" || el.type === "line" || el.type === "freedraw") return;

      const elLeft = el.x;
      const elRight = el.x + el.width;
      const elCenterX = el.x + el.width / 2;
      const elTop = el.y;
      const elBottom = el.y + el.height;
      const elCenterY = el.y + el.height / 2;

      // Check vertical alignment (left, center, right edges)
      if (Math.abs(movingLeft - elLeft) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'v', pos: elLeft });
        snapX = elLeft;
      } else if (Math.abs(movingLeft - elRight) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'v', pos: elRight });
        snapX = elRight;
      } else if (Math.abs(movingRight - elLeft) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'v', pos: elLeft });
        snapX = elLeft - movingElement.width;
      } else if (Math.abs(movingRight - elRight) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'v', pos: elRight });
        snapX = elRight - movingElement.width;
      } else if (Math.abs(movingCenterX - elCenterX) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'v', pos: elCenterX });
        snapX = elCenterX - movingElement.width / 2;
      }

      // Check horizontal alignment (top, center, bottom edges)
      if (Math.abs(movingTop - elTop) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'h', pos: elTop });
        snapY = elTop;
      } else if (Math.abs(movingTop - elBottom) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'h', pos: elBottom });
        snapY = elBottom;
      } else if (Math.abs(movingBottom - elTop) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'h', pos: elTop });
        snapY = elTop - movingElement.height;
      } else if (Math.abs(movingBottom - elBottom) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'h', pos: elBottom });
        snapY = elBottom - movingElement.height;
      } else if (Math.abs(movingCenterY - elCenterY) < ALIGNMENT_TOLERANCE) {
        guides.push({ type: 'h', pos: elCenterY });
        snapY = elCenterY - movingElement.height / 2;
      }
    });

    return { guides, snapX, snapY };
  };

  // Connector snap points - find nearby element connection points
  const SNAP_DISTANCE = 15;

  // Get connection points for an element (center and edge midpoints)
  const getElementSnapPoints = (element: CanvasElement): { x: number; y: number; type: string }[] => {
    // Skip arrows, lines, freedraw, and text for snap targets
    if (element.type === "arrow" || element.type === "line" || element.type === "freedraw" || element.type === "text") {
      return [];
    }

    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;

    return [
      { x: centerX, y: centerY, type: "center" },
      { x: centerX, y: element.y, type: "top" },
      { x: centerX, y: element.y + element.height, type: "bottom" },
      { x: element.x, y: centerY, type: "left" },
      { x: element.x + element.width, y: centerY, type: "right" },
    ];
  };

  // Find the nearest snap point within snap distance
  const findNearestSnapPoint = (
    x: number,
    y: number,
    excludeElementId?: string
  ): { x: number; y: number; elementId: string } | null => {
    let nearestPoint: { x: number; y: number; elementId: string } | null = null;
    let minDistance = SNAP_DISTANCE;

    elements.forEach((element) => {
      if (element.id === excludeElementId) return;

      const snapPoints = getElementSnapPoints(element);
      snapPoints.forEach((point) => {
        const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = { x: point.x, y: point.y, elementId: element.id };
        }
      });
    });

    return nearestPoint;
  };

  // Text editing helpers
  const enterEditMode = useCallback((element: TextElement) => {
    setEditingElementId(element.id);
    setEditingText(element.content || "");
    setIsNewTextElement(false); // Existing element, not new
    // Focus input after React renders it
    if (textFocusTimeoutRef.current) {
      clearTimeout(textFocusTimeoutRef.current);
    }
    textFocusTimeoutRef.current = setTimeout(() => {
      textInputRef.current?.focus();
      // Move cursor to end instead of selecting all (Excalidraw behavior)
      if (textInputRef.current) {
        const len = textInputRef.current.value.length;
        textInputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  }, []);

  const commitTextEdit = () => {
    if (!editingElementId) return;
    const editingElement = elements.find((el) => el.id === editingElementId);
    if (!editingElement || editingElement.type !== "text") {
      exitEditMode();
      return;
    }

    const trimmedText = editingText.trim();

    // If empty, delete the element (no placeholder)
    if (!trimmedText) {
      recordSnapshot(); // Record for undo

      // If this is bound text, also remove the reference from the container
      const textEl = editingElement as TextElement;
      if (textEl.containerId) {
        const container = elements.find(el => el.id === textEl.containerId);
        if (container && container.boundElements) {
          const updatedContainer = {
            ...container,
            boundElements: container.boundElements.filter(be => be.id !== editingElementId)
          };
          setElements(
            elements
              .filter((el) => el.id !== editingElementId)
              .map(el => el.id === textEl.containerId ? updatedContainer : el)
          );
        } else {
          setElements(elements.filter((el) => el.id !== editingElementId));
        }
      } else {
        setElements(elements.filter((el) => el.id !== editingElementId));
      }

      setSelectedElementId(null);
      exitEditMode();
      return;
    }

    // Calculate dimensions
    const textEl = editingElement as TextElement;
    const fontSize = textEl.fontSize || 16;
    const fontWeight = textEl.fontWeight || "normal";
    const fontStyle = textEl.fontStyle || "normal";
    const lineHeight = textEl.lineHeight || Math.round(fontSize * 1.5);
    const lineCount = trimmedText.split("\n").length;

    // Calculate auto-width if enabled
    const oldWidth = editingElement.width;
    let finalWidth = oldWidth;
    if (textEl.autoWidth !== false) {
      finalWidth = calculateAutoWidth(trimmedText, {
        fontSize,
        fontWeight,
        fontStyle,
      });
    }

    const finalHeight = Math.max(
      lineCount * lineHeight + TEXT_PADDING * 2,
      lineHeight + TEXT_PADDING * 2,
    );

    // For center/right-aligned text, adjust x position to keep text visually stable
    // when width changes (e.g., due to trimming trailing spaces)
    let finalX = editingElement.x;
    const textAlign = textEl.textAlign || "left";
    if (finalWidth !== oldWidth) {
      const widthDiff = oldWidth - finalWidth;
      if (textAlign === "center") {
        // Keep center position stable: adjust x by half the width difference
        finalX = editingElement.x + widthDiff / 2;
      } else if (textAlign === "right") {
        // Keep right edge stable: adjust x by full width difference
        finalX = editingElement.x + widthDiff;
      }
      // For left-aligned, x stays the same (left edge stable)
    }

    setElements(
      elements.map((el) =>
        el.id === editingElementId && el.type === "text"
          ? ({
              ...el,
              content: trimmedText,
              x: finalX,
              width: finalWidth,
              height: finalHeight,
            } as TextElement)
          : el,
      ),
    );
    exitEditMode();
  };

  const exitEditMode = () => {
    setEditingElementId(null);
    setEditingText("");
    setIsNewTextElement(false);
  };

  // Double-click handler for entering text edit mode
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;

    const { element: clickedElement } = findElementAtPoint(x, y);

    if (clickedElement && clickedElement.type === "text") {
      // Edit existing text element (including bound text) - skip if locked
      if (clickedElement.locked !== true) {
        enterEditMode(clickedElement as TextElement);
      } else {
        addToast({
          type: 'warning',
          title: 'Element is locked',
          message: 'Unlock the element to edit it',
          duration: 2000
        });
      }
    } else if (clickedElement && isContainerElement(clickedElement)) {
      // Double-click on container shape (rectangle, ellipse, diamond)
      // Create new bound text or edit existing bound text - skip if locked
      if (clickedElement.locked === true) {
        addToast({
          type: 'warning',
          title: 'Element is locked',
          message: 'Unlock the element to edit it',
          duration: 2000
        });
        return;
      }

      const existingBoundText = getBoundTextElement(clickedElement, elements);

      if (existingBoundText) {
        // Edit existing bound text (also check if bound text is locked)
        if (existingBoundText.locked !== true) {
          enterEditMode(existingBoundText);
        } else {
          addToast({
            type: 'warning',
            title: 'Text is locked',
            message: 'Unlock the text to edit it',
            duration: 2000
          });
        }
      } else {
        // Create new bound text element
        recordSnapshot(); // Record for undo
        const newTextElement = createBoundTextElement(clickedElement);

        // Add bound element reference to container
        const boundElementRef: BoundElement = { id: newTextElement.id, type: 'text' };
        const updatedContainer = {
          ...clickedElement,
          boundElements: [...(clickedElement.boundElements || []), boundElementRef]
        };

        // Update elements: replace container with updated one and add new text element
        const updatedElements = elements.map(el =>
          el.id === clickedElement.id ? updatedContainer : el
        );
        setElements([...updatedElements, newTextElement]);
        setSelectedElementId(newTextElement.id);
        setIsNewTextElement(true);

        // Enter edit mode immediately
        setEditingElementId(newTextElement.id);
        setEditingText("");

        if (textFocusTimeoutRef.current) {
          clearTimeout(textFocusTimeoutRef.current);
        }
        textFocusTimeoutRef.current = setTimeout(() => {
          textInputRef.current?.focus();
        }, 0);
      }
    } else if (!clickedElement) {
      // Double-click on empty canvas: create new text element (Excalidraw behavior)
      recordSnapshot(); // Record for undo
      const newElement: TextElement = {
        id: generateId(),
        type: "text",
        x,
        y,
        width: MIN_TEXT_WIDTH,
        height: 24,
        content: "",
        autoWidth: true,
      };
      setElements([...elements, newElement]);
      setSelectedElementId(newElement.id);
      setIsNewTextElement(true);

      // Enter edit mode immediately
      setEditingElementId(newElement.id);
      setEditingText("");

      if (textFocusTimeoutRef.current) {
        clearTimeout(textFocusTimeoutRef.current);
      }
      textFocusTimeoutRef.current = setTimeout(() => {
        textInputRef.current?.focus();
      }, 0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Clear hover state when starting any interaction
    setHoveredElementId(null);

    // If in edit mode, clicking outside the text input commits the edit
    if (editingElementId) {
      commitTextEdit();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Middle mouse button, Alt+drag, or Space+drag starts panning
    if (e.button === 1 || (e.button === 0 && (e.altKey || isSpaceHeld))) {
      setIsPanning(true);
      setLastPanPoint({ x: screenX, y: screenY });
      e.preventDefault();
      return;
    }

    // Convert screen coordinates to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;

    if (currentTool === "select") {
      // FIRST: Check if clicking on resize/rotation handles of the currently selected element
      // This must happen before findElementAtPoint because handles are outside element bounds
      if (selectedElementId && selectedElementIds.size <= 1) {
        const selectedElement = elements.find((el) => el.id === selectedElementId);
        if (selectedElement) {
          const isInGroup = selectedElement.groupId || selectedElement.elementGroupId;
          const isLocked = selectedElement.locked === true;

          // Show toast if trying to interact with handles of a locked element
          if (isLocked && !isInGroup) {
            const clickedRotationHandle = isOnRotationHandle(x, y, selectedElement);
            const clickedResizeHandle = getResizeHandle(x, y, selectedElement);
            if (clickedRotationHandle || clickedResizeHandle) {
              addToast({
                type: 'warning',
                title: 'Element is locked',
                message: 'Unlock the element to modify it',
                duration: 2000
              });
              return;
            }
          }

          if (!isInGroup && !isLocked) {
            // Check rotation handle first (skip if locked)
            if (isOnRotationHandle(x, y, selectedElement)) {
              recordSnapshot();
              const centerX = selectedElement.x + selectedElement.width / 2;
              const centerY = selectedElement.y + selectedElement.height / 2;
              const mouseAngle = Math.atan2(y - centerY, x - centerX);
              setIsRotating(true);
              setRotationStart({
                initialAngle: selectedElement.rotation || 0,
                elementCenterX: centerX,
                elementCenterY: centerY,
                startMouseAngle: mouseAngle,
              });
              setIsDrawing(true);
              return;
            }

            // Check resize handles
            const handle = getResizeHandle(x, y, selectedElement);
            if (handle) {
              recordSnapshot();
              setResizeHandle(handle);
              const snapshot: typeof resizeSnapshot = {
                initialBounds: {
                  x: selectedElement.x,
                  y: selectedElement.y,
                  width: selectedElement.width,
                  height: selectedElement.height,
                },
                pointerOrigin: { x, y },
              };
              if (selectedElement.type === "arrow" || selectedElement.type === "line") {
                const lineEl = selectedElement as ArrowElement | LineElement;
                snapshot.arrowEndpoints = {
                  startX: lineEl.startX,
                  startY: lineEl.startY,
                  endX: lineEl.endX,
                  endY: lineEl.endY,
                };
              }
              setResizeSnapshot(snapshot);
              setIsDrawing(true);
              return;
            }
          }
        }
      }

      // Next, check if clicking on a component instance (they render on top)
      const clickedInstance = findInstanceAtPoint(x, y);

      if (clickedInstance) {
        // Clear element selections when selecting an instance
        setSelectedElementId(null);
        setSelectedElementIds(new Set());
        setSelectedGroupId(null);
        setSelectedInstanceId(clickedInstance.id);

        // Start dragging the instance
        recordSnapshot();
        setDragOffset({ x: x - clickedInstance.x, y: y - clickedInstance.y });
        setIsDrawing(true);
        return;
      }

      // Then check for elements
      const { element: clickedElement, groupId } = findElementAtPoint(x, y);

      if (clickedElement) {
        // Clear instance selection when selecting an element
        setSelectedInstanceId(null);

        // Check if element is part of a user-created element group
        const elementGroup = clickedElement.elementGroupId
          ? elementGroups.find((g) => g.id === clickedElement.elementGroupId)
          : undefined;

        // Handle Shift+click for multi-selection
        if (e.shiftKey) {
          // Get all element IDs to add (including group members if applicable)
          const idsToToggle = elementGroup
            ? elementGroup.elementIds
            : [clickedElement.id];

          setSelectedElementIds((prev) => {
            const newSet = new Set(prev);

            // CRITICAL FIX: If there's already a selectedElementId (from a previous single-click)
            // that's not in selectedElementIds, include it in the multi-selection.
            // This ensures the first selected element is part of the group when grouping.
            if (selectedElementId && !newSet.has(selectedElementId)) {
              // Check if the primary selected element is in a group, include all group members
              const primaryElement = elements.find(el => el.id === selectedElementId);
              if (primaryElement?.elementGroupId) {
                const primaryGroup = elementGroups.find(g => g.id === primaryElement.elementGroupId);
                if (primaryGroup) {
                  primaryGroup.elementIds.forEach(id => newSet.add(id));
                } else {
                  newSet.add(selectedElementId);
                }
              } else {
                newSet.add(selectedElementId);
              }
            }

            // If the clicked element (or any in its group) is already selected, remove them
            const alreadySelected = idsToToggle.some((id) => newSet.has(id));
            if (alreadySelected) {
              idsToToggle.forEach((id) => newSet.delete(id));
            } else {
              idsToToggle.forEach((id) => newSet.add(id));
            }
            return newSet;
          });
          // Don't change primary selection or start dragging in multi-select mode
          return;
        }

        // Single-click-to-edit: If clicking an already-selected text element, enter edit mode
        if (
          clickedElement.type === "text" &&
          selectedElementId === clickedElement.id &&
          !e.shiftKey
        ) {
          enterEditMode(clickedElement as TextElement);
          return;
        }

        // Single click (no Shift): select element and its group members
        // Set clicked element as primary selection (enables intuitive drag behavior)
        setSelectedElementId(clickedElement.id);

        // If element is in a user-created group, select all group members
        if (elementGroup) {
          setSelectedElementIds(new Set(elementGroup.elementIds));
        } else if (selectedElementIds.has(clickedElement.id) && selectedElementIds.size > 1) {
          // Clicked element is part of existing multi-selection - preserve it
          // This allows dragging multiple marquee-selected elements together
          // No action needed - selectedElementIds remains unchanged
        } else {
          // Clear multi-selection for single element
          setSelectedElementIds(new Set());
        }

        // If element is part of component group, select the component group
        if (groupId) {
          setSelectedGroupId(groupId);
        } else {
          setSelectedGroupId(null);
        }

        // Start dragging the clicked element (unless locked)
        // (Handle checks for selected element are done earlier, before findElementAtPoint)
        if (clickedElement.locked !== true) {
          recordSnapshot();
          setDragOffset({ x: x - clickedElement.x, y: y - clickedElement.y });
          setIsDrawing(true);
        } else {
          // Show toast when trying to drag a locked element
          addToast({
            type: 'warning',
            title: 'Element is locked',
            message: 'Unlock the element to move it',
            duration: 2000
          });
        }
      } else {
        // Clicked on empty space - start marquee selection
        // Clear previous selections unless Shift is held (to add to selection)
        if (!e.shiftKey) {
          setSelectedElementId(null);
          setSelectedElementIds(new Set());
          setSelectedGroupId(null);
          setSelectedInstanceId(null);
        }

        // Start marquee selection
        setIsMarqueeSelecting(true);
        setMarqueeStart({ x, y });
        setMarqueeEnd({ x, y });
      }
    } else {
      setIsDrawing(true);
      setStartPoint({ x, y });

      // Freedraw tool: start collecting points immediately
      if (currentTool === "freedraw") {
        setFreedrawPoints([{ x, y }]);
      }
      // Text tool: click-to-place and immediately enter edit mode
      else if (currentTool === "text") {
        recordSnapshot(); // Record for undo
        const newElement: TextElement = {
          id: generateId(),
          type: "text",
          x,
          y,
          width: MIN_TEXT_WIDTH,
          height: 24, // Single line height
          content: "", // Empty - no placeholder
          autoWidth: true,
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        setIsDrawing(false);
        setStartPoint(null);

        // Immediately enter edit mode
        setEditingElementId(newElement.id);
        setEditingText("");
        setIsNewTextElement(true);

        // Focus textarea after render
        if (textFocusTimeoutRef.current) {
          clearTimeout(textFocusTimeoutRef.current);
        }
        textFocusTimeoutRef.current = setTimeout(() => {
          textInputRef.current?.focus();
        }, 0);
      }
      // Other tools (rectangle, ellipse, arrow, line) are drag-to-draw in handleMouseUp
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Disable canvas interactions during text editing
    if (editingElementId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Handle panning
    if (isPanning && lastPanPoint) {
      const dx = screenX - lastPanPoint.x;
      const dy = screenY - lastPanPoint.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: screenX, y: screenY });
      return;
    }

    // Convert to canvas coordinates
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;

    // Handle marquee selection drag
    if (isMarqueeSelecting) {
      setMarqueeEnd({ x, y });
      return;
    }

    // Track hover state when in select mode and not actively drawing
    if (currentTool === "select" && !isDrawing) {
      // Check for resize/rotation handle hover on selected element first
      // Only show handles for single selection (not multi-selection)
      const isSingleSelection = selectedElementIds.size <= 1;
      if (selectedElementId && isSingleSelection) {
        const selectedElement = elements.find((el) => el.id === selectedElementId);
        if (selectedElement) {
          const isInGroup = selectedElement.groupId || selectedElement.elementGroupId;
          if (!isInGroup) {
            // Check rotation handle first
            if (isOnRotationHandle(x, y, selectedElement)) {
              setHoveredHandle("rotation");
              setHoveredElementId(selectedElementId);
              return;
            }
            // Check resize handles
            const handle = getResizeHandle(x, y, selectedElement);
            if (handle) {
              setHoveredHandle(handle);
              setHoveredElementId(selectedElementId);
              return;
            }
          }
        }
      }
      // No handle hovered, check for element hover
      setHoveredHandle(null);
      const { element: hoveredElement } = findElementAtPoint(x, y);
      if (hoveredElement) {
        setHoveredElementId(hoveredElement.id);
      } else {
        setHoveredElementId(null);
      }
      return;
    }

    // Return early if not in an active interaction
    if (!isDrawing) return;

    // Handle instance dragging
    if (currentTool === "select" && selectedInstanceId && dragOffset && isDrawing) {
      const instance = componentInstances.find(i => i.id === selectedInstanceId);
      if (instance) {
        const rawX = x - dragOffset.x;
        const rawY = y - dragOffset.y;

        // Apply grid snap if enabled
        const finalX = snapToGrid ? snapToGridCoord(rawX) : rawX;
        const finalY = snapToGrid ? snapToGridCoord(rawY) : rawY;

        // Show snap guides when snapping to grid
        if (snapToGrid) {
          setSnapGuides([
            { type: 'v', pos: finalX },
            { type: 'h', pos: finalY },
          ]);
        } else {
          setSnapGuides([]);
        }

        setComponentInstances(
          componentInstances.map(i =>
            i.id === selectedInstanceId
              ? { ...i, x: finalX, y: finalY }
              : i
          )
        );
        return;
      }
    }

    if (currentTool === "select" && selectedElementId) {
      const element = elements.find((el) => el.id === selectedElementId);
      if (!element) return;

      // Handle rotation mode
      if (isRotating && rotationStart) {
        const { initialAngle, elementCenterX, elementCenterY, startMouseAngle } = rotationStart;
        const currentMouseAngle = Math.atan2(y - elementCenterY, x - elementCenterX);
        let newAngle = initialAngle + (currentMouseAngle - startMouseAngle);

        // Snap to 15-degree increments when holding Shift
        if (e.shiftKey) {
          const snapAngle = Math.PI / 12; // 15 degrees
          newAngle = Math.round(newAngle / snapAngle) * snapAngle;
        }

        setElements(
          elements.map((el) =>
            el.id === selectedElementId ? { ...el, rotation: newAngle } : el
          )
        );
        return;
      }

      if (resizeHandle && resizeSnapshot) {
        const { initialBounds, pointerOrigin, arrowEndpoints } = resizeSnapshot;
        const dx = x - pointerOrigin.x; // Pointer delta X
        const dy = y - pointerOrigin.y; // Pointer delta Y

        if (
          (element.type === "arrow" || element.type === "line") &&
          arrowEndpoints
        ) {
          // ARROW/LINE RESIZE MODE: Move the start or end point to change length/direction.
          // The opposite endpoint stays fixed as the anchor.
          //
          // Handle Mapping:
          //   'start' → move startX/startY, endX/endY stays fixed
          //   'end'   → move endX/endY, startX/startY stays fixed

          let newStartX = arrowEndpoints.startX;
          let newStartY = arrowEndpoints.startY;
          let newEndX = arrowEndpoints.endX;
          let newEndY = arrowEndpoints.endY;

          if (resizeHandle === "start") {
            const rawX = arrowEndpoints.startX + dx;
            const rawY = arrowEndpoints.startY + dy;
            // Snap to nearby elements
            const snap = findNearestSnapPoint(rawX, rawY, selectedElementId || undefined);
            newStartX = snap ? snap.x : rawX;
            newStartY = snap ? snap.y : rawY;
          } else if (resizeHandle === "end") {
            const rawX = arrowEndpoints.endX + dx;
            const rawY = arrowEndpoints.endY + dy;
            // Snap to nearby elements
            const snap = findNearestSnapPoint(rawX, rawY, selectedElementId || undefined);
            newEndX = snap ? snap.x : rawX;
            newEndY = snap ? snap.y : rawY;
          }

          // Update bounding box to contain both endpoints
          const newX = Math.min(newStartX, newEndX);
          const newY = Math.min(newStartY, newEndY);
          const newWidth = Math.abs(newEndX - newStartX) || 1;
          const newHeight = Math.abs(newEndY - newStartY) || 1;

          setElements(
            elements.map((el) => {
              if (
                el.id === selectedElementId &&
                (el.type === "arrow" || el.type === "line")
              ) {
                return {
                  ...el,
                  x: newX,
                  y: newY,
                  width: newWidth,
                  height: newHeight,
                  startX: newStartX,
                  startY: newStartY,
                  endX: newEndX,
                  endY: newEndY,
                } as ArrowElement | LineElement;
              }
              return el;
            }),
          );
        } else if (element.type === "text" && (resizeHandle === "e" || resizeHandle === "w")) {
          // TEXT HORIZONTAL RESIZE MODE: Only adjust width, auto-wrap text
          const textEl = element as TextElement;

          // Compute anchor (the edge that stays fixed)
          const anchorX = resizeHandle === "w"
            ? initialBounds.x + initialBounds.width // Anchor is on the right (E side)
            : initialBounds.x; // Anchor is on the left (W side)

          // Compute new moving edge position
          const movingEdgeInitialX = resizeHandle === "w"
            ? initialBounds.x
            : initialBounds.x + initialBounds.width;

          let newMovingX = movingEdgeInitialX + dx;

          // Clamp to minimum width
          if (resizeHandle === "w") {
            newMovingX = Math.min(newMovingX, anchorX - MIN_ELEMENT_SIZE);
          } else {
            newMovingX = Math.max(newMovingX, anchorX + MIN_ELEMENT_SIZE);
          }

          // Calculate new x and width
          const newX = Math.min(anchorX, newMovingX);
          const newWidth = Math.abs(newMovingX - anchorX);

          // Calculate new height based on text wrapping with new width
          const fontSize = textEl.fontSize || 16;
          const fontWeight = textEl.fontWeight || "normal";
          const fontStyle = textEl.fontStyle || "normal";
          const lineHeight = textEl.lineHeight || Math.round(fontSize * 1.5);

          // Create an offscreen canvas to measure text
          const measureCanvas = document.createElement("canvas");
          const measureCtx = measureCanvas.getContext("2d");
          if (measureCtx) {
            const fontString = `${fontStyle === "italic" ? "italic " : ""}${fontWeight === "bold" ? "bold " : ""}${fontSize}px sans-serif`;
            measureCtx.font = fontString;

            const maxWidth = newWidth - TEXT_PADDING * 2;
            const lines = wrapText(measureCtx, textEl.content || "", maxWidth);
            const newHeight = Math.max(lineHeight, lines.length * lineHeight);

            setElements(
              elements.map((el) => {
                if (el.id === selectedElementId && el.type === "text") {
                  return {
                    ...el,
                    x: newX,
                    width: newWidth,
                    height: newHeight,
                    autoWidth: false, // Disable auto-width when manually resized
                  } as TextElement;
                }
                return el;
              }),
            );
          }
        } else if (element.type !== "arrow" && element.type !== "line") {
          // RECTANGLE RESIZE MODE: Compute new bounds from the snapshot.
          //
          // Handle-to-Anchor Mapping:
          //   Handle   |  Fixed Anchor Corner
          //   ---------+----------------------
          //   'nw'     |  SE corner (x + width, y + height)
          //   'ne'     |  SW corner (x, y + height)
          //   'sw'     |  NE corner (x + width, y)
          //   'se'     |  NW corner (x, y)

          // Compute the anchor corner (opposite corner that must stay fixed)
          const anchorX = resizeHandle.includes("w")
            ? initialBounds.x + initialBounds.width // Anchor is on the right (E side)
            : initialBounds.x; // Anchor is on the left (W side)
          const anchorY = resizeHandle.includes("n")
            ? initialBounds.y + initialBounds.height // Anchor is on the bottom (S side)
            : initialBounds.y; // Anchor is on the top (N side)

          // Compute new moving corner position (the corner being dragged)
          const movingCornerInitialX = resizeHandle.includes("w")
            ? initialBounds.x
            : initialBounds.x + initialBounds.width;
          const movingCornerInitialY = resizeHandle.includes("n")
            ? initialBounds.y
            : initialBounds.y + initialBounds.height;

          let newMovingX = movingCornerInitialX + dx;
          let newMovingY = movingCornerInitialY + dy;

          // Shift key: maintain aspect ratio during resize
          if (e.shiftKey && initialBounds.width > 0 && initialBounds.height > 0) {
            const aspectRatio = initialBounds.width / initialBounds.height;
            const currentWidth = Math.abs(newMovingX - anchorX);
            const currentHeight = Math.abs(newMovingY - anchorY);

            // Determine which dimension to constrain based on which changed more
            const widthChange = Math.abs(dx);
            const heightChange = Math.abs(dy);

            if (widthChange >= heightChange) {
              // Width is driving, adjust height to match ratio
              const constrainedHeight = currentWidth / aspectRatio;
              if (resizeHandle.includes("n")) {
                newMovingY = anchorY - constrainedHeight;
              } else {
                newMovingY = anchorY + constrainedHeight;
              }
            } else {
              // Height is driving, adjust width to match ratio
              const constrainedWidth = currentHeight * aspectRatio;
              if (resizeHandle.includes("w")) {
                newMovingX = anchorX - constrainedWidth;
              } else {
                newMovingX = anchorX + constrainedWidth;
              }
            }
          }

          // Clamp moving corner to enforce minimum size and prevent inversion.
          if (resizeHandle.includes("w")) {
            newMovingX = Math.min(newMovingX, anchorX - MIN_ELEMENT_SIZE);
          } else {
            newMovingX = Math.max(newMovingX, anchorX + MIN_ELEMENT_SIZE);
          }

          if (resizeHandle.includes("n")) {
            newMovingY = Math.min(newMovingY, anchorY - MIN_ELEMENT_SIZE);
          } else {
            newMovingY = Math.max(newMovingY, anchorY + MIN_ELEMENT_SIZE);
          }

          // Derive final x, y, width, height from anchor and clamped moving corner
          const newX = Math.min(anchorX, newMovingX);
          const newY = Math.min(anchorY, newMovingY);
          const newWidth = Math.abs(newMovingX - anchorX);
          const newHeight = Math.abs(newMovingY - anchorY);

          // Update element bounds
          let updatedElements = elements.map((el) => {
            if (el.id === selectedElementId) {
              return {
                ...el,
                x: newX,
                y: newY,
                width: newWidth,
                height: newHeight,
              };
            }
            return el;
          });

          // Sync bound text position if this is a container element
          if (isContainerElement(element)) {
            updatedElements = syncBoundTextPosition(selectedElementId, updatedElements);
          }

          setElements(updatedElements);
        }
      } else if (dragOffset) {
        // Move - either group or individual element
        const dx = x - dragOffset.x - element.x;
        const dy = y - dragOffset.y - element.y;

        if (selectedGroupId) {
          // Move entire component group
          moveGroup(selectedGroupId, dx, dy);
        } else if (element.elementGroupId) {
          // Move entire user-created element group
          moveElementGroup(element.elementGroupId, dx, dy);
        } else if (selectedElementIds.size > 1) {
          // Move multiple selected elements (not in a group)
          moveSelectedElements(dx, dy);
        } else {
          // Move single element with optional grid snap and alignment guides
          const rawX = x - dragOffset.x;
          const rawY = y - dragOffset.y;

          // Check for alignment guides (only if not snapping to grid)
          let finalX = snapToGridCoord(rawX);
          let finalY = snapToGridCoord(rawY);

          if (!snapToGrid) {
            const { guides, snapX, snapY } = findAlignmentGuides(element, rawX, rawY);
            setAlignmentGuides(guides);
            finalX = snapX;
            finalY = snapY;
            setSnapGuides([]);
          } else {
            setAlignmentGuides([]);
            // Calculate snap guides to show which grid lines we're snapping to
            const guides: { type: 'h' | 'v'; pos: number }[] = [];
            // Add vertical guide for left edge (x position)
            guides.push({ type: 'v', pos: finalX });
            // Add horizontal guide for top edge (y position)
            guides.push({ type: 'h', pos: finalY });
            setSnapGuides(guides);
          }

          const snapDx = finalX - element.x;
          const snapDy = finalY - element.y;

          // Update element position
          let updatedElements = elements.map((el) => {
            if (el.id === selectedElementId) {
              if (el.type === "arrow" || el.type === "line") {
                // Arrows and lines need endpoint updates when moved
                const lineEl = el as ArrowElement | LineElement;
                return {
                  ...lineEl,
                  x: finalX,
                  y: finalY,
                  startX: lineEl.startX + snapDx,
                  startY: lineEl.startY + snapDy,
                  endX: lineEl.endX + snapDx,
                  endY: lineEl.endY + snapDy,
                };
              }
              if (el.type === "freedraw") {
                // Freedraw elements need all points updated when moved
                const freedrawEl = el as FreedrawElement;
                return {
                  ...freedrawEl,
                  x: finalX,
                  y: finalY,
                  points: freedrawEl.points.map((p) => ({
                    x: p.x + snapDx,
                    y: p.y + snapDy,
                  })),
                };
              }
              return { ...el, x: finalX, y: finalY };
            }
            return el;
          });

          // Sync bound text position if this is a container element
          if (isContainerElement(element)) {
            updatedElements = syncBoundTextPosition(selectedElementId, updatedElements);
          }

          setElements(updatedElements);
        }
      }
    } else if (
      startPoint &&
      (currentTool === "rectangle" ||
        currentTool === "ellipse" ||
        currentTool === "diamond" ||
        currentTool === "arrow" ||
        currentTool === "line")
    ) {
      // Preview while drawing (drag-to-draw tools)
      redraw();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      // Apply zoom/pan transform for preview (redraw() restores context after drawing)
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      ctx.strokeStyle = canvasTheme.sketch;
      ctx.lineWidth = 1.5 / zoom; // Adjust line width for zoom
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([8 / zoom, 4 / zoom]); // Adjust dash pattern for zoom

      const previewSeed = Date.now() % 1000;

      if (currentTool === "rectangle") {
        let width = x - startPoint.x;
        let height = y - startPoint.y;
        // Shift key: constrain to square
        if (e.shiftKey) {
          const size = Math.max(Math.abs(width), Math.abs(height));
          width = width >= 0 ? size : -size;
          height = height >= 0 ? size : -size;
        }
        drawSketchRect(
          ctx,
          startPoint.x,
          startPoint.y,
          width,
          height,
          previewSeed,
        );
      } else if (currentTool === "ellipse") {
        let width = x - startPoint.x;
        let height = y - startPoint.y;
        // Shift key: constrain to circle
        if (e.shiftKey) {
          const size = Math.max(Math.abs(width), Math.abs(height));
          width = width >= 0 ? size : -size;
          height = height >= 0 ? size : -size;
        }
        drawSketchEllipse(
          ctx,
          startPoint.x,
          startPoint.y,
          width,
          height,
          previewSeed,
        );
      } else if (currentTool === "diamond") {
        let width = x - startPoint.x;
        let height = y - startPoint.y;
        // Shift key: constrain to square diamond
        if (e.shiftKey) {
          const size = Math.max(Math.abs(width), Math.abs(height));
          width = width >= 0 ? size : -size;
          height = height >= 0 ? size : -size;
        }
        drawSketchDiamond(
          ctx,
          width > 0 ? startPoint.x : startPoint.x + width,
          height > 0 ? startPoint.y : startPoint.y + height,
          Math.abs(width),
          Math.abs(height),
          previewSeed,
        );
      } else if (currentTool === "arrow" || currentTool === "line") {
        // Find snap points for preview
        const startSnap = findNearestSnapPoint(startPoint.x, startPoint.y);
        let rawEndX = x;
        let rawEndY = y;

        // Shift key: constrain to 45-degree angles
        if (e.shiftKey) {
          const constrained = constrainToAngle(startPoint.x, startPoint.y, x, y);
          rawEndX = constrained.x;
          rawEndY = constrained.y;
        }

        const endSnap = e.shiftKey ? null : findNearestSnapPoint(rawEndX, rawEndY);
        const previewStartX = startSnap ? startSnap.x : startPoint.x;
        const previewStartY = startSnap ? startSnap.y : startPoint.y;
        const previewEndX = endSnap ? endSnap.x : rawEndX;
        const previewEndY = endSnap ? endSnap.y : rawEndY;

        drawSketchLine(ctx, previewStartX, previewStartY, previewEndX, previewEndY, previewSeed);

        // Draw snap indicators
        ctx.setLineDash([]);
        if (startSnap) {
          ctx.beginPath();
          ctx.arc(startSnap.x, startSnap.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (endSnap) {
          ctx.beginPath();
          ctx.arc(endSnap.x, endSnap.y, 6, 0, Math.PI * 2);
          ctx.strokeStyle = canvasTheme.selected;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      ctx.setLineDash([]);
      ctx.restore();
    } else if (currentTool === "freedraw" && isDrawing && freedrawPoints.length > 0) {
      // Freedraw: add point and preview
      setFreedrawPoints((prev) => [...prev, { x, y }]);

      redraw();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;

      // Apply zoom transform for preview
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      ctx.strokeStyle = canvasTheme.sketch;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw preview of current freehand path
      const currentPoints = [...freedrawPoints, { x, y }];
      drawFreedraw(ctx, currentPoints);

      ctx.restore();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Disable canvas interactions during text editing
    if (editingElementId) return;

    // End panning
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    // Handle end of marquee selection
    if (isMarqueeSelecting) {
      const selectedIds = getElementsInMarquee();

      if (selectedIds.length > 0) {
        // If Shift was held when starting, add to existing selection
        if (e.shiftKey) {
          setSelectedElementIds((prev) => {
            const newSet = new Set(prev);
            selectedIds.forEach((id) => newSet.add(id));
            return newSet;
          });
        } else {
          // Replace selection with new marquee selection
          setSelectedElementIds(new Set(selectedIds));
        }

        // Set the first selected element as the primary selection
        setSelectedElementId(selectedIds[0]);
      }

      // Clear marquee state
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }

    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasCoords = screenToCanvas(screenX, screenY);
    const x = canvasCoords.x;
    const y = canvasCoords.y;

    if (startPoint && currentTool !== "select" && currentTool !== "text") {
      let width = x - startPoint.x;
      let height = y - startPoint.y;

      // Shift key: constrain to square/circle for shapes
      if (e.shiftKey && (currentTool === "rectangle" || currentTool === "ellipse" || currentTool === "diamond")) {
        const size = Math.max(Math.abs(width), Math.abs(height));
        width = width >= 0 ? size : -size;
        height = height >= 0 ? size : -size;
      }

      if (currentTool === "rectangle") {
        recordSnapshot(); // Record for undo
        // Use default size if click without dragging, otherwise use dragged dimensions
        const isDraggedEnough = Math.abs(width) > MIN_DRAG_DISTANCE && Math.abs(height) > MIN_DRAG_DISTANCE;
        const finalWidth = isDraggedEnough ? Math.abs(width) : DEFAULT_CLICK_SHAPE_SIZE;
        const finalHeight = isDraggedEnough ? Math.abs(height) : DEFAULT_CLICK_SHAPE_SIZE;
        // Center shape on click point if no drag, otherwise position based on drag direction
        const finalX = isDraggedEnough
          ? (width > 0 ? startPoint.x : startPoint.x + width)
          : startPoint.x - DEFAULT_CLICK_SHAPE_SIZE / 2;
        const finalY = isDraggedEnough
          ? (height > 0 ? startPoint.y : startPoint.y + height)
          : startPoint.y - DEFAULT_CLICK_SHAPE_SIZE / 2;
        const newElement: RectangleElement = {
          id: generateId(),
          type: "rectangle",
          x: finalX,
          y: finalY,
          width: finalWidth,
          height: finalHeight,
          style: { strokeColor: currentStrokeColor, fillColor: currentFillColor },
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        announce('Created rectangle');
      } else if (currentTool === "ellipse") {
        recordSnapshot(); // Record for undo
        // Use default size if click without dragging, otherwise use dragged dimensions
        const isDraggedEnough = Math.abs(width) > MIN_DRAG_DISTANCE && Math.abs(height) > MIN_DRAG_DISTANCE;
        const finalWidth = isDraggedEnough ? Math.abs(width) : DEFAULT_CLICK_SHAPE_SIZE;
        const finalHeight = isDraggedEnough ? Math.abs(height) : DEFAULT_CLICK_SHAPE_SIZE;
        // Center shape on click point if no drag, otherwise position based on drag direction
        const finalX = isDraggedEnough
          ? (width > 0 ? startPoint.x : startPoint.x + width)
          : startPoint.x - DEFAULT_CLICK_SHAPE_SIZE / 2;
        const finalY = isDraggedEnough
          ? (height > 0 ? startPoint.y : startPoint.y + height)
          : startPoint.y - DEFAULT_CLICK_SHAPE_SIZE / 2;
        const newElement: EllipseElement = {
          id: generateId(),
          type: "ellipse",
          x: finalX,
          y: finalY,
          width: finalWidth,
          height: finalHeight,
          style: { strokeColor: currentStrokeColor, fillColor: currentFillColor },
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        announce('Created ellipse');
      } else if (currentTool === "diamond") {
        recordSnapshot(); // Record for undo
        // Use default size if click without dragging, otherwise use dragged dimensions
        const isDraggedEnough = Math.abs(width) > MIN_DRAG_DISTANCE && Math.abs(height) > MIN_DRAG_DISTANCE;
        const finalWidth = isDraggedEnough ? Math.abs(width) : DEFAULT_CLICK_SHAPE_SIZE;
        const finalHeight = isDraggedEnough ? Math.abs(height) : DEFAULT_CLICK_SHAPE_SIZE;
        // Center shape on click point if no drag, otherwise position based on drag direction
        const finalX = isDraggedEnough
          ? (width > 0 ? startPoint.x : startPoint.x + width)
          : startPoint.x - DEFAULT_CLICK_SHAPE_SIZE / 2;
        const finalY = isDraggedEnough
          ? (height > 0 ? startPoint.y : startPoint.y + height)
          : startPoint.y - DEFAULT_CLICK_SHAPE_SIZE / 2;
        const newElement: DiamondElement = {
          id: generateId(),
          type: "diamond",
          x: finalX,
          y: finalY,
          width: finalWidth,
          height: finalHeight,
          style: { strokeColor: currentStrokeColor, fillColor: currentFillColor },
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        announce('Created diamond');
      } else if (currentTool === "arrow") {
        recordSnapshot(); // Record for undo
        // Handle Shift key for angle constraint
        let rawEndX = x;
        let rawEndY = y;
        if (e.shiftKey) {
          const constrained = constrainToAngle(startPoint.x, startPoint.y, x, y);
          rawEndX = constrained.x;
          rawEndY = constrained.y;
        }
        // Snap start and end points to nearby elements (skip end snap if shift is held)
        const startSnap = findNearestSnapPoint(startPoint.x, startPoint.y);
        const endSnap = e.shiftKey ? null : findNearestSnapPoint(rawEndX, rawEndY);
        const finalStartX = startSnap ? startSnap.x : startPoint.x;
        const finalStartY = startSnap ? startSnap.y : startPoint.y;
        const finalEndX = endSnap ? endSnap.x : rawEndX;
        const finalEndY = endSnap ? endSnap.y : rawEndY;

        const newElement: ArrowElement = {
          id: generateId(),
          type: "arrow",
          x: Math.min(finalStartX, finalEndX),
          y: Math.min(finalStartY, finalEndY),
          width: Math.abs(finalEndX - finalStartX) || 1,
          height: Math.abs(finalEndY - finalStartY) || 1,
          startX: finalStartX,
          startY: finalStartY,
          endX: finalEndX,
          endY: finalEndY,
          style: { strokeColor: currentStrokeColor, fillColor: currentFillColor },
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        announce('Created arrow');
      } else if (currentTool === "line") {
        recordSnapshot(); // Record for undo
        // Handle Shift key for angle constraint
        let rawEndX = x;
        let rawEndY = y;
        if (e.shiftKey) {
          const constrained = constrainToAngle(startPoint.x, startPoint.y, x, y);
          rawEndX = constrained.x;
          rawEndY = constrained.y;
        }
        // Snap start and end points to nearby elements (skip end snap if shift is held)
        const startSnap = findNearestSnapPoint(startPoint.x, startPoint.y);
        const endSnap = e.shiftKey ? null : findNearestSnapPoint(rawEndX, rawEndY);
        const finalStartX = startSnap ? startSnap.x : startPoint.x;
        const finalStartY = startSnap ? startSnap.y : startPoint.y;
        const finalEndX = endSnap ? endSnap.x : rawEndX;
        const finalEndY = endSnap ? endSnap.y : rawEndY;

        const newElement: LineElement = {
          id: generateId(),
          type: "line",
          x: Math.min(finalStartX, finalEndX),
          y: Math.min(finalStartY, finalEndY),
          width: Math.abs(finalEndX - finalStartX) || 1,
          height: Math.abs(finalEndY - finalStartY) || 1,
          startX: finalStartX,
          startY: finalStartY,
          endX: finalEndX,
          endY: finalEndY,
          style: { strokeColor: currentStrokeColor, fillColor: currentFillColor },
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        announce('Created line');
      } else if (currentTool === "freedraw" && freedrawPoints.length >= 2) {
        recordSnapshot(); // Record for undo
        // Calculate bounding box from points
        const allPoints = [...freedrawPoints, { x, y }];
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        allPoints.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });

        const newElement: FreedrawElement = {
          id: generateId(),
          type: "freedraw",
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 1),
          height: Math.max(maxY - minY, 1),
          points: allPoints,
          style: { strokeColor: currentStrokeColor, fillColor: currentFillColor },
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        setFreedrawPoints([]);
        announce('Created freedraw');
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setFreedrawPoints([]);
    setDragOffset(null);
    setAlignmentGuides([]); // Clear alignment guides when drag ends
    setSnapGuides([]); // Clear snap guides when drag ends
    setResizeHandle(null);
    setResizeSnapshot(null); // Clear resize snapshot on pointer up
    setIsRotating(false);
    setRotationStart(null);
  };

  // Copy selected elements to clipboard
  const copySelectedElements = useCallback(() => {
    const elementsToCopy: CanvasElement[] = [];

    // If multiple elements selected, copy all of them
    if (selectedElementIds.size > 0) {
      elements.forEach((el) => {
        if (selectedElementIds.has(el.id)) {
          elementsToCopy.push(structuredClone(el));
        }
      });
    }
    // If single element selected
    else if (selectedElementId) {
      const element = elements.find((el) => el.id === selectedElementId);
      if (element) {
        // If element is in a group, copy all group elements
        if (element.elementGroupId) {
          const group = elementGroups.find(
            (g) => g.id === element.elementGroupId
          );
          if (group) {
            group.elementIds.forEach((id) => {
              const groupEl = elements.find((el) => el.id === id);
              if (groupEl) {
                elementsToCopy.push(structuredClone(groupEl));
              }
            });
          }
        } else {
          elementsToCopy.push(structuredClone(element));
        }
      }
    }

    if (elementsToCopy.length > 0) {
      setClipboard(elementsToCopy);
    }
  }, [elements, selectedElementId, selectedElementIds, elementGroups]);

  // Paste elements from clipboard
  const pasteElements = useCallback(() => {
    if (clipboard.length === 0) return;

    recordSnapshot(); // Record for undo

    const PASTE_OFFSET = 20; // Offset from original position
    const newElements: CanvasElement[] = [];
    const idMapping: Map<string, string> = new Map();

    // First pass: create new IDs
    clipboard.forEach((el) => {
      const newId = generateId();
      idMapping.set(el.id, newId);
    });

    // Second pass: create elements with new IDs and offset positions
    clipboard.forEach((el) => {
      const newId = idMapping.get(el.id)!;
      const newElement: CanvasElement = {
        ...el,
        id: newId,
        x: el.x + PASTE_OFFSET,
        y: el.y + PASTE_OFFSET,
        // Clear group references (pasted elements are ungrouped)
        groupId: undefined,
        elementGroupId: undefined,
        componentType: undefined,
      };

      // Handle arrow/line specific properties
      if (newElement.type === "arrow" || newElement.type === "line") {
        const lineEl = newElement as ArrowElement | LineElement;
        lineEl.startX += PASTE_OFFSET;
        lineEl.startY += PASTE_OFFSET;
        lineEl.endX += PASTE_OFFSET;
        lineEl.endY += PASTE_OFFSET;
      }

      newElements.push(newElement);
    });

    setElements([...elements, ...newElements]);

    // Select the pasted elements
    const newIds = new Set(newElements.map((el) => el.id));
    setSelectedElementIds(newIds);
    setSelectedElementId(newElements[0].id);
  }, [clipboard, elements, recordSnapshot]);

  // Duplicate selected elements (copy + paste in one action)
  const duplicateSelectedElements = useCallback(() => {
    const elementsToDuplicate: CanvasElement[] = [];

    // If multiple elements selected, duplicate all of them
    if (selectedElementIds.size > 0) {
      elements.forEach((el) => {
        if (selectedElementIds.has(el.id)) {
          elementsToDuplicate.push(el);
        }
      });
    }
    // If single element selected
    else if (selectedElementId) {
      const element = elements.find((el) => el.id === selectedElementId);
      if (element) {
        // If element is in a group, duplicate all group elements
        if (element.elementGroupId) {
          const group = elementGroups.find(
            (g) => g.id === element.elementGroupId
          );
          if (group) {
            group.elementIds.forEach((id) => {
              const groupEl = elements.find((el) => el.id === id);
              if (groupEl) {
                elementsToDuplicate.push(groupEl);
              }
            });
          }
        } else {
          elementsToDuplicate.push(element);
        }
      }
    }

    if (elementsToDuplicate.length === 0) return;

    recordSnapshot(); // Record for undo

    const DUPLICATE_OFFSET = 20;
    const newElements: CanvasElement[] = [];

    elementsToDuplicate.forEach((el) => {
      const newId = generateId();
      const newElement: CanvasElement = {
        ...structuredClone(el),
        id: newId,
        x: el.x + DUPLICATE_OFFSET,
        y: el.y + DUPLICATE_OFFSET,
        // Clear group references
        groupId: undefined,
        elementGroupId: undefined,
        componentType: undefined,
      };

      // Handle arrow/line specific properties
      if (newElement.type === "arrow" || newElement.type === "line") {
        const lineEl = newElement as ArrowElement | LineElement;
        lineEl.startX += DUPLICATE_OFFSET;
        lineEl.startY += DUPLICATE_OFFSET;
        lineEl.endX += DUPLICATE_OFFSET;
        lineEl.endY += DUPLICATE_OFFSET;
      }

      // Recalculate height for text elements with fixed width (autoWidth: false)
      // to ensure wrapped text content fits within the element bounds
      if (newElement.type === "text") {
        const textEl = newElement as TextElement;
        if (textEl.autoWidth === false && textEl.content) {
          // Create a measurement canvas to calculate wrapped lines
          const measureCanvas = document.createElement("canvas");
          const measureCtx = measureCanvas.getContext("2d");
          if (measureCtx) {
            const fontSize = textEl.fontSize || 16;
            const fontWeight = textEl.fontWeight || "normal";
            const fontStyle = textEl.fontStyle || "normal";
            const lineHeight = textEl.lineHeight || Math.round(fontSize * 1.5);
            const fontString = `${fontStyle === "italic" ? "italic " : ""}${fontWeight === "bold" ? "bold " : ""}${fontSize}px sans-serif`;
            measureCtx.font = fontString;

            const maxWidth = textEl.width - TEXT_PADDING * 2;
            const lines = wrapText(measureCtx, textEl.content, maxWidth);
            const calculatedHeight = Math.max(
              lineHeight + TEXT_PADDING * 2,
              lines.length * lineHeight + TEXT_PADDING * 2
            );
            textEl.height = calculatedHeight;
          }
        }
      }

      newElements.push(newElement);
    });

    setElements([...elements, ...newElements]);

    // Select the duplicated elements
    const newIds = new Set(newElements.map((el) => el.id));
    setSelectedElementIds(newIds);
    setSelectedElementId(newElements[0].id);
  }, [
    elements,
    selectedElementId,
    selectedElementIds,
    elementGroups,
    recordSnapshot,
  ]);

  // Layer control functions
  // Bring selected element(s) to front
  const bringToFront = useCallback(() => {
    if (!selectedElementId && selectedElementIds.size === 0) return;

    recordSnapshot();
    const idsToMove = selectedElementIds.size > 0
      ? selectedElementIds
      : new Set([selectedElementId!]);

    setElements((prev) => {
      const toMove = prev.filter((el) => idsToMove.has(el.id));
      const remaining = prev.filter((el) => !idsToMove.has(el.id));
      return [...remaining, ...toMove];
    });
  }, [selectedElementId, selectedElementIds, recordSnapshot]);

  // Send selected element(s) to back
  const sendToBack = useCallback(() => {
    if (!selectedElementId && selectedElementIds.size === 0) return;

    recordSnapshot();
    const idsToMove = selectedElementIds.size > 0
      ? selectedElementIds
      : new Set([selectedElementId!]);

    setElements((prev) => {
      const toMove = prev.filter((el) => idsToMove.has(el.id));
      const remaining = prev.filter((el) => !idsToMove.has(el.id));
      return [...toMove, ...remaining];
    });
  }, [selectedElementId, selectedElementIds, recordSnapshot]);

  // Bring selected element(s) forward by one position
  const bringForward = useCallback(() => {
    if (!selectedElementId && selectedElementIds.size === 0) return;

    recordSnapshot();
    const idsToMove = selectedElementIds.size > 0
      ? selectedElementIds
      : new Set([selectedElementId!]);

    setElements((prev) => {
      const newElements = [...prev];
      // Find the highest index among selected elements
      let maxIndex = -1;
      for (let i = 0; i < newElements.length; i++) {
        if (idsToMove.has(newElements[i].id)) {
          maxIndex = i;
        }
      }
      // If not already at front, swap with next element
      if (maxIndex >= 0 && maxIndex < newElements.length - 1) {
        // Move all selected elements forward
        for (let i = newElements.length - 2; i >= 0; i--) {
          if (idsToMove.has(newElements[i].id) && !idsToMove.has(newElements[i + 1].id)) {
            [newElements[i], newElements[i + 1]] = [newElements[i + 1], newElements[i]];
          }
        }
      }
      return newElements;
    });
  }, [selectedElementId, selectedElementIds, recordSnapshot]);

  // Send selected element(s) backward by one position
  const sendBackward = useCallback(() => {
    if (!selectedElementId && selectedElementIds.size === 0) return;

    recordSnapshot();
    const idsToMove = selectedElementIds.size > 0
      ? selectedElementIds
      : new Set([selectedElementId!]);

    setElements((prev) => {
      const newElements = [...prev];
      // Find the lowest index among selected elements
      let minIndex = newElements.length;
      for (let i = 0; i < newElements.length; i++) {
        if (idsToMove.has(newElements[i].id)) {
          minIndex = i;
          break;
        }
      }
      // If not already at back, swap with previous element
      if (minIndex > 0) {
        // Move all selected elements backward
        for (let i = 1; i < newElements.length; i++) {
          if (idsToMove.has(newElements[i].id) && !idsToMove.has(newElements[i - 1].id)) {
            [newElements[i - 1], newElements[i]] = [newElements[i], newElements[i - 1]];
          }
        }
      }
      return newElements;
    });
  }, [selectedElementId, selectedElementIds, recordSnapshot]);

  // Nudge selected element(s) by dx, dy pixels (for arrow key navigation)
  const nudgeSelectedElements = useCallback((dx: number, dy: number) => {
    if (!selectedElementId && selectedElementIds.size === 0) return;

    const idsToMove = selectedElementIds.size > 0
      ? selectedElementIds
      : new Set([selectedElementId!]);

    // Check if any selected element is locked
    const hasLockedElement = elements.some(
      (el) => idsToMove.has(el.id) && el.locked
    );
    if (hasLockedElement) {
      addToast({
        type: "warning",
        title: "Element locked",
        message: "Cannot move locked elements.",
      });
      return;
    }

    recordSnapshot();

    setElements((prev) =>
      prev.map((el) => {
        if (!idsToMove.has(el.id)) return el;

        // Calculate new position
        let newX = el.x + dx;
        let newY = el.y + dy;

        // Apply snap-to-grid if enabled
        if (snapToGrid) {
          newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
          newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        }

        return { ...el, x: newX, y: newY };
      })
    );

    // Also move bound text elements for shapes
    const boundTextIds = new Set<string>();
    elements.forEach((el) => {
      if (idsToMove.has(el.id) && el.type !== "text") {
        const boundText = elements.find(
          (t) => t.type === "text" && (t as TextElement).containerId === el.id
        );
        if (boundText) {
          boundTextIds.add(boundText.id);
        }
      }
    });

    if (boundTextIds.size > 0) {
      setElements((prev) =>
        prev.map((el) => {
          if (!boundTextIds.has(el.id)) return el;

          let newX = el.x + dx;
          let newY = el.y + dy;

          if (snapToGrid) {
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
          }

          return { ...el, x: newX, y: newY };
        })
      );
    }

    const count = idsToMove.size;
    const direction =
      dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";
    announce(
      `Moved ${count} element${count > 1 ? "s" : ""} ${direction} by ${Math.abs(dx || dy)} pixels`
    );
  }, [selectedElementId, selectedElementIds, elements, snapToGrid, recordSnapshot, addToast, announce]);

  // Cycle through elements for selection with Tab/Shift+Tab (accessibility)
  const cycleElementSelection = useCallback((reverse: boolean) => {
    if (elements.length === 0) return;

    // Get visible (non-hidden) elements only
    const visibleElements = elements.filter((el) => el.visible !== false);
    if (visibleElements.length === 0) return;

    let nextIndex: number;

    if (!selectedElementId) {
      // No selection: select first (or last if reverse) element
      nextIndex = reverse ? visibleElements.length - 1 : 0;
    } else {
      // Find current selection index in visible elements
      const currentIndex = visibleElements.findIndex((el) => el.id === selectedElementId);
      if (currentIndex === -1) {
        // Current selection is hidden, start from beginning
        nextIndex = reverse ? visibleElements.length - 1 : 0;
      } else {
        // Move to next/previous
        if (reverse) {
          nextIndex = currentIndex === 0 ? visibleElements.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === visibleElements.length - 1 ? 0 : currentIndex + 1;
        }
      }
    }

    const nextElement = visibleElements[nextIndex];
    setSelectedElementId(nextElement.id);
    setSelectedElementIds(new Set([nextElement.id]));
    setSelectedGroupId(null);

    announce(
      `Selected ${nextElement.type} element (${nextIndex + 1} of ${visibleElements.length})`
    );
  }, [elements, selectedElementId, announce]);

  // Frame management handlers
  const handleCreateFrame = (type: FrameType) => {
    const frameId = generateFrameId();
    const createdAt = new Date().toISOString();

    // Uses functional update to avoid stale closure issues
    setFrames((prevFrames) => {
      const newFrame: Frame = {
        id: frameId,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${prevFrames.length + 1}`,
        type,
        elements: [],
        createdAt,
      };
      return [...prevFrames, newFrame];
    });
    setActiveFrameId(frameId); // Auto-switch to new frame
  };

  const handleSwitchFrame = (frameId: string) => {
    // Current frame state is already persisted in frames array
    setActiveFrameId(frameId);
    // Clear all selections when switching frames
    setSelectedElementId(null);
    setSelectedElementIds(new Set());
    setSelectedGroupId(null);
  };

  const handleRenameFrame = (frameId: string, newName: string) => {
    // Uses functional update to avoid stale closure issues
    setFrames((prevFrames) =>
      prevFrames.map((frame) =>
        frame.id === frameId ? { ...frame, name: newName } : frame,
      ),
    );
  };

  const handleDeleteFrame = (frameId: string) => {
    // Safety: Prevent deleting the last frame
    if (frames.length === 1) {
      addToast({
        type: "warning",
        title: "Cannot delete frame",
        message: "You must have at least one frame.",
      });
      return;
    }

    // Uses functional update to avoid stale closure issues
    setFrames((prevFrames) => {
      const newFrames = prevFrames.filter((f) => f.id !== frameId);

      // Safety: If deleted active frame, switch to first frame (with bounds check)
      if (frameId === activeFrameId && newFrames.length > 0) {
        // Schedule the active frame change for after this update
        setTimeout(() => setActiveFrameId(newFrames[0].id), 0);
      }

      return newFrames;
    });
  };

  // Handler for reordering frames via drag-drop
  const handleReorderFrames = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    // Uses functional update to avoid stale closure issues
    setFrames((prevFrames) => {
      if (fromIndex < 0 || fromIndex >= prevFrames.length) return prevFrames;
      if (toIndex < 0 || toIndex >= prevFrames.length) return prevFrames;

      const newFrames = [...prevFrames];
      const [movedFrame] = newFrames.splice(fromIndex, 1);
      newFrames.splice(toIndex, 0, movedFrame);
      return newFrames;
    });
  };

  // Handler for frame deletion request (shows confirm dialog)
  const handleRequestDeleteFrame = (frameId: string, frameName: string) => {
    if (frames.length === 1) {
      addToast({
        type: "warning",
        title: "Cannot delete frame",
        message: "You must have at least one frame.",
      });
      return;
    }

    showConfirmDialog(
      `Delete "${frameName}"?`,
      "This will permanently delete this frame and all its elements. This action cannot be undone.",
      () => handleDeleteFrame(frameId),
      "danger",
    );
  };

  // Component group operations
  const generateGroupId = () =>
    `grp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const createComponentGroup = (
    template: ComponentTemplate,
    insertX: number,
    insertY: number,
  ): ComponentGroup => {
    const groupId = generateGroupId();
    const elementIds: string[] = [];

    // Create all elements with group reference
    const newElements: CanvasElement[] = template.elements
      .map((tplEl) => {
        const elId = generateId();
        elementIds.push(elId);

        const baseProps = {
          id: elId,
          x: insertX + tplEl.offsetX,
          y: insertY + tplEl.offsetY,
          width: tplEl.width,
          height: tplEl.height,
          semanticTag: tplEl.semanticTag,
          description: tplEl.description,
          groupId,
          componentType: template.type,
        };

        if (tplEl.type === "text") {
          return {
            ...baseProps,
            type: "text",
            content: tplEl.content || "Text",
            textAlign: tplEl.textAlign,
          } as TextElement;
        } else if (tplEl.type === "rectangle") {
          return {
            ...baseProps,
            type: "rectangle",
          } as RectangleElement;
        } else if (tplEl.type === "arrow") {
          // Arrow support (if needed in future templates)
          return {
            ...baseProps,
            type: "arrow",
            startX: insertX + tplEl.offsetX,
            startY: insertY + tplEl.offsetY,
            endX: insertX + tplEl.offsetX + tplEl.width,
            endY: insertY + tplEl.offsetY + tplEl.height,
          } as ArrowElement;
        } else if (tplEl.type === "line") {
          // Line support - use explicit startX/startY/endX/endY if provided
          return {
            ...baseProps,
            type: "line",
            startX: insertX + (tplEl.startX ?? tplEl.offsetX),
            startY: insertY + (tplEl.startY ?? tplEl.offsetY),
            endX: insertX + (tplEl.endX ?? tplEl.offsetX + tplEl.width),
            endY: insertY + (tplEl.endY ?? tplEl.offsetY),
          } as LineElement;
        } else if (tplEl.type === "ellipse") {
          return {
            ...baseProps,
            type: "ellipse",
          } as EllipseElement;
        }
        return null;
      })
      .filter(
        (
          el,
        ): el is
          | RectangleElement
          | EllipseElement
          | TextElement
          | ArrowElement
          | LineElement => el !== null,
      );

    // Add elements to canvas
    setElements([...elements, ...newElements]);

    // Create group
    const group: ComponentGroup = {
      id: groupId,
      componentType: template.type,
      x: insertX,
      y: insertY,
      elementIds,
      createdAt: new Date().toISOString(),
    };

    setComponentGroups([...componentGroups, group]);

    return group;
  };

  // Create template as ElementGroup (regular grouped elements, not component group)
  // This spawns component templates without the purple "Component: X" styling
  const createTemplateAsElementGroup = (
    template: ComponentTemplate,
    insertX: number,
    insertY: number,
  ): ElementGroup => {
    const groupId = generateElementGroupId();
    const elementIds: string[] = [];

    // Create all elements with elementGroupId reference (NOT groupId/componentType)
    const newElements: CanvasElement[] = template.elements
      .map((tplEl) => {
        const elId = generateId();
        elementIds.push(elId);

        const baseProps = {
          id: elId,
          x: insertX + tplEl.offsetX,
          y: insertY + tplEl.offsetY,
          width: tplEl.width,
          height: tplEl.height,
          semanticTag: tplEl.semanticTag,
          description: tplEl.description,
          elementGroupId: groupId, // Use elementGroupId instead of groupId
          // DO NOT set componentType - we want regular group styling
        };

        if (tplEl.type === "text") {
          return {
            ...baseProps,
            type: "text",
            content: tplEl.content || "Text",
            textAlign: tplEl.textAlign,
          } as TextElement;
        } else if (tplEl.type === "rectangle") {
          return {
            ...baseProps,
            type: "rectangle",
          } as RectangleElement;
        } else if (tplEl.type === "arrow") {
          return {
            ...baseProps,
            type: "arrow",
            startX: insertX + tplEl.offsetX,
            startY: insertY + tplEl.offsetY,
            endX: insertX + tplEl.offsetX + tplEl.width,
            endY: insertY + tplEl.offsetY + tplEl.height,
          } as ArrowElement;
        } else if (tplEl.type === "line") {
          return {
            ...baseProps,
            type: "line",
            startX: insertX + (tplEl.startX ?? tplEl.offsetX),
            startY: insertY + (tplEl.startY ?? tplEl.offsetY),
            endX: insertX + (tplEl.endX ?? tplEl.offsetX + tplEl.width),
            endY: insertY + (tplEl.endY ?? tplEl.offsetY),
          } as LineElement;
        } else if (tplEl.type === "ellipse") {
          return {
            ...baseProps,
            type: "ellipse",
          } as EllipseElement;
        }
        return null;
      })
      .filter(
        (
          el,
        ): el is
          | RectangleElement
          | EllipseElement
          | TextElement
          | ArrowElement
          | LineElement => el !== null,
      );

    // Add elements to canvas
    setElements([...elements, ...newElements]);

    // Create ElementGroup (not ComponentGroup)
    const group: ElementGroup = {
      id: groupId,
      elementIds,
      frameId: activeFrameId,
      createdAt: new Date().toISOString(),
    };

    setElementGroups([...elementGroups, group]);

    return group;
  };

  const moveGroup = (groupId: string, dx: number, dy: number) => {
    setElements(
      elements.map((el) => {
        if (el.groupId !== groupId) return el;

        if (el.type === "arrow" || el.type === "line") {
          const lineEl = el as ArrowElement | LineElement;
          return {
            ...lineEl,
            x: el.x + dx,
            y: el.y + dy,
            startX: lineEl.startX + dx,
            startY: lineEl.startY + dy,
            endX: lineEl.endX + dx,
            endY: lineEl.endY + dy,
          };
        }
        if (el.type === "freedraw") {
          const freedrawEl = el as FreedrawElement;
          return {
            ...freedrawEl,
            x: el.x + dx,
            y: el.y + dy,
            points: freedrawEl.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      }),
    );

    setComponentGroups(
      componentGroups.map((grp) =>
        grp.id === groupId ? { ...grp, x: grp.x + dx, y: grp.y + dy } : grp,
      ),
    );
  };

  // Move all elements in a user-created element group
  const moveElementGroup = (elementGroupId: string, dx: number, dy: number) => {
    setElements(
      elements.map((el) => {
        if (el.elementGroupId !== elementGroupId) return el;

        if (el.type === "arrow" || el.type === "line") {
          const lineEl = el as ArrowElement | LineElement;
          return {
            ...lineEl,
            x: el.x + dx,
            y: el.y + dy,
            startX: lineEl.startX + dx,
            startY: lineEl.startY + dy,
            endX: lineEl.endX + dx,
            endY: lineEl.endY + dy,
          };
        }
        if (el.type === "freedraw") {
          const freedrawEl = el as FreedrawElement;
          return {
            ...freedrawEl,
            x: el.x + dx,
            y: el.y + dy,
            points: freedrawEl.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      }),
    );
  };

  // Move all currently selected elements (for multi-selection without grouping)
  const moveSelectedElements = (dx: number, dy: number) => {
    setElements(
      elements.map((el) => {
        if (!selectedElementIds.has(el.id)) return el;

        if (el.type === "arrow" || el.type === "line") {
          const lineEl = el as ArrowElement | LineElement;
          return {
            ...lineEl,
            x: el.x + dx,
            y: el.y + dy,
            startX: lineEl.startX + dx,
            startY: lineEl.startY + dy,
            endX: lineEl.endX + dx,
            endY: lineEl.endY + dy,
          };
        }
        if (el.type === "freedraw") {
          const freedrawEl = el as FreedrawElement;
          return {
            ...freedrawEl,
            x: el.x + dx,
            y: el.y + dy,
            points: freedrawEl.points.map((p) => ({
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      }),
    );
  };

  // Generate unique element group ID
  const generateElementGroupId = () =>
    `egrp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Create a new user element group from selected elements
  const createElementGroup = useCallback(() => {
    // Need at least 2 elements selected to create a group
    if (selectedElementIds.size < 2) return;

    const selectedElements = elements.filter((el) =>
      selectedElementIds.has(el.id),
    );

    // Prevent grouping if any element is already in a group (no nested groups)
    const hasGroupedElements = selectedElements.some(
      (el) => el.elementGroupId || el.groupId,
    );
    if (hasGroupedElements) {
      return; // Silently fail - could show a message in the future
    }

    // Prevent grouping elements from different frames (currently all elements are from active frame)
    // This is automatically enforced since we only work with elements from activeFrame

    // Collect bound text elements for selected containers
    const boundTextIds = new Set<string>();
    selectedElements.forEach((el) => {
      if (isContainerElement(el) && el.boundElements) {
        el.boundElements.forEach((be) => {
          if (be.type === 'text') {
            boundTextIds.add(be.id);
          }
        });
      }
    });

    recordSnapshot(); // Record for undo

    const groupId = generateElementGroupId();
    const elementIds = [...Array.from(selectedElementIds), ...Array.from(boundTextIds)];

    // Update elements with group reference (including bound text)
    setElements(
      elements.map((el) =>
        selectedElementIds.has(el.id) || boundTextIds.has(el.id)
          ? { ...el, elementGroupId: groupId }
          : el,
      ),
    );

    // Create the group record
    const newGroup: ElementGroup = {
      id: groupId,
      elementIds,
      frameId: activeFrameId,
      createdAt: new Date().toISOString(),
    };

    setElementGroups([...elementGroups, newGroup]);

    // Keep the elements selected (now as a group)
    // selectedElementIds already contains all elements
  }, [selectedElementIds, elements, recordSnapshot, activeFrameId, elementGroups]);

  // Ungroup a user-created element group
  // Uses functional updates to avoid stale closure issues when called from confirmation dialogs
  const ungroupElements = useCallback((elementGroupId: string) => {
    recordSnapshot(); // Record for undo
    // Remove group reference from all elements
    setElements(prev =>
      prev.map((el) =>
        el.elementGroupId === elementGroupId
          ? { ...el, elementGroupId: undefined }
          : el,
      ),
    );

    // Remove the group record
    setElementGroups(prev => prev.filter((grp) => grp.id !== elementGroupId));

    // Keep elements selected individually
    // selectedElementIds remains unchanged
  }, [recordSnapshot]);

  // Delete all elements in a user-created element group
  // Uses functional updates to avoid stale closure issues when called from confirmation dialogs
  const deleteElementGroup = useCallback((elementGroupId: string) => {
    recordSnapshot(); // Record for undo
    setElements(prev => prev.filter((el) => el.elementGroupId !== elementGroupId));
    setElementGroups(prev => prev.filter((grp) => grp.id !== elementGroupId));

    // Clear selections
    setSelectedElementIds(new Set());
    setSelectedElementId(null);
  }, [recordSnapshot]);

  // Uses functional updates to avoid stale closure issues when called from confirmation dialogs
  const ungroupComponent = useCallback((groupId: string) => {
    recordSnapshot(); // Record for undo
    // Remove group reference from all elements
    setElements(prev =>
      prev.map((el) =>
        el.groupId === groupId
          ? { ...el, groupId: undefined, componentType: undefined }
          : el,
      ),
    );

    // Remove group
    setComponentGroups(prev => prev.filter((grp) => grp.id !== groupId));

    // Clear group selection
    setSelectedGroupId(currentId => currentId === groupId ? null : currentId);
  }, [recordSnapshot]);

  // Uses functional updates to avoid stale closure issues when called from confirmation dialogs
  const deleteGroup = useCallback((groupId: string) => {
    recordSnapshot(); // Record for undo
    setElements(prev => prev.filter((el) => el.groupId !== groupId));
    setComponentGroups(prev => prev.filter((grp) => grp.id !== groupId));

    // Clear selections
    setSelectedGroupId(null);
    setSelectedElementId(null);
  }, [recordSnapshot]);

  // Generate unique user component ID
  const generateUserComponentId = () =>
    `ucomp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Generate unique component instance ID
  const generateComponentInstanceId = () =>
    `cinst_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Generate unique element ID within a component
  const generateComponentElementId = () =>
    `cel_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Convert a canvas element to a component element definition (relative positioning)
  const elementToComponentDef = (
    element: CanvasElement,
    originX: number,
    originY: number
  ): ComponentElementDef => {
    const baseDef: ComponentElementDef = {
      id: generateComponentElementId(),
      type: element.type,
      offsetX: element.x - originX,
      offsetY: element.y - originY,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      semanticTag: element.semanticTag,
      description: element.description,
      style: element.style,
    };

    // Add type-specific properties
    if (element.type === 'text') {
      const textEl = element as TextElement;
      baseDef.content = textEl.content;
      baseDef.fontSize = textEl.fontSize;
      baseDef.fontWeight = textEl.fontWeight;
      baseDef.fontStyle = textEl.fontStyle;
      baseDef.textAlign = textEl.textAlign;
      baseDef.lineHeight = textEl.lineHeight;
      baseDef.preset = textEl.preset;
      baseDef.autoWidth = textEl.autoWidth;
    } else if (element.type === 'arrow' || element.type === 'line') {
      const lineEl = element as ArrowElement | LineElement;
      baseDef.startX = lineEl.startX - originX;
      baseDef.startY = lineEl.startY - originY;
      baseDef.endX = lineEl.endX - originX;
      baseDef.endY = lineEl.endY - originY;
    } else if (element.type === 'freedraw') {
      const freedrawEl = element as FreedrawElement;
      // Translate points relative to origin
      baseDef.points = freedrawEl.points.map(p => ({
        x: p.x - originX,
        y: p.y - originY,
      }));
    }

    return baseDef;
  };

  // Promote an element group to a user component
  const promoteGroupToComponent = (elementGroupId: string, componentName: string) => {
    const group = elementGroups.find(g => g.id === elementGroupId);
    if (!group) return;

    const groupElements = elements.filter(el => el.elementGroupId === elementGroupId);
    if (groupElements.length === 0) return;

    // Prevent promoting if any element is already a component instance
    // (no nested components in v1)
    // Note: We check for component groups too
    const hasComponentGroupElements = groupElements.some(el => el.groupId);
    if (hasComponentGroupElements) {
      addToast({
        type: 'error',
        title: 'Cannot create component',
        message: 'Groups containing component elements cannot be promoted.',
      });
      return;
    }

    recordSnapshot(); // Record for undo

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of groupElements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    const width = maxX - minX;
    const height = maxY - minY;

    // Convert elements to component definitions (relative to top-left)
    const masterElements: ComponentElementDef[] = groupElements.map(el =>
      elementToComponentDef(el, minX, minY)
    );

    // Create the user component
    const now = new Date().toISOString();
    const newComponent: UserComponent = {
      id: generateUserComponentId(),
      name: componentName || 'Untitled Component',
      masterElements,
      width,
      height,
      createdAt: now,
      updatedAt: now,
    };

    // Create an instance to replace the original group
    const newInstance: ComponentInstance = {
      id: generateComponentInstanceId(),
      componentId: newComponent.id,
      frameId: activeFrameId,
      x: minX,
      y: minY,
      createdAt: now,
    };

    // Remove the original elements from the canvas
    // Use functional update to avoid stale closure issues
    setElements(prev => prev.filter(el => el.elementGroupId !== elementGroupId));

    // Remove the element group record
    setElementGroups(prev => prev.filter(g => g.id !== elementGroupId));

    // Add the new component to the library
    setUserComponents([...userComponents, newComponent]);

    // Add the instance
    setComponentInstances([...componentInstances, newInstance]);

    // Select the new instance
    setSelectedElementId(null);
    setSelectedElementIds(new Set());
    setSelectedInstanceId(newInstance.id);

    addToast({
      type: 'success',
      title: 'Component created',
      message: `"${componentName}" is now available in your component library.`,
    });
  };

  // Start the promote flow by opening the name dialog
  const startPromoteGroupToComponent = useCallback((elementGroupId: string) => {
    setPendingPromoteGroupId(elementGroupId);
    setNewComponentName('');
    setIsPromoteDialogOpen(true);
  }, []);

  // Handle the promote dialog confirmation
  const handlePromoteDialogConfirm = () => {
    if (pendingPromoteGroupId && newComponentName.trim()) {
      promoteGroupToComponent(pendingPromoteGroupId, newComponentName.trim());
    }
    setIsPromoteDialogOpen(false);
    setPendingPromoteGroupId(null);
    setNewComponentName('');
  };

  // Cancel the promote dialog
  const handlePromoteDialogCancel = () => {
    setIsPromoteDialogOpen(false);
    setPendingPromoteGroupId(null);
    setNewComponentName('');
  };

  // Instantiate a user component at a position
  const instantiateComponent = (componentId: string, x: number, y: number, frameId: string) => {
    const component = userComponents.find(c => c.id === componentId);
    if (!component) return null;

    recordSnapshot(); // Record for undo

    const newInstance: ComponentInstance = {
      id: generateComponentInstanceId(),
      componentId,
      frameId,
      x,
      y,
      createdAt: new Date().toISOString(),
    };

    setComponentInstances([...componentInstances, newInstance]);
    return newInstance;
  };

  // Delete a component instance
  const deleteComponentInstance = useCallback((instanceId: string) => {
    recordSnapshot(); // Record for undo
    setComponentInstances(componentInstances.filter(i => i.id !== instanceId));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
  }, [recordSnapshot, componentInstances, selectedInstanceId]);

  // Keep keyboard callbacks ref in sync - this runs synchronously before useEffect
  // Allows the keyboard handler to access latest callbacks without re-registering the listener
  keyboardCallbacksRef.current = {
    performUndo,
    performRedo,
    recordSnapshot,
    copySelectedElements,
    pasteElements,
    duplicateSelectedElements,
    zoomIn,
    zoomOut,
    resetZoom,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    nudgeSelectedElements,
    cycleElementSelection,
    toggleDocPanel,
    toggleElementVisibility,
    toggleElementLock,
    announce,
    enterEditMode,
    createElementGroup,
    ungroupElements,
    ungroupComponent,
    deleteElementGroup,
    deleteGroup,
    startPromoteGroupToComponent,
    deleteComponentInstance,
    showConfirmDialog,
    setShowGrid,
    setSnapToGrid,
  };

  // Keyboard event handler for deletion, grouping, and ungrouping
  // Uses keyboardStateRef and keyboardCallbacksRef to read current values without causing re-registration
  // This significantly reduces event listener churn when state changes frequently
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Spacebar for pan mode - handle before other checks so it works in most contexts
      // Skip when typing in inputs to allow normal space character input
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLInputElement ||
                             activeElement instanceof HTMLTextAreaElement ||
                             activeElement?.getAttribute('contenteditable') === 'true';

      if (e.code === "Space" && !isInputFocused) {
        e.preventDefault(); // Prevent page scroll
        setIsSpaceHeld(true);
        return;
      }

      // Read current state from ref to avoid closure stale values
      const {
        selectedElementId: currentSelectedElementId,
        selectedElementIds: currentSelectedElementIds,
        selectedInstanceId: currentSelectedInstanceId,
        elements: currentElements,
        componentGroups: currentComponentGroups,
        elementGroups: currentElementGroups,
        editingElementId: currentEditingElementId,
        isPromoteDialogOpen: currentIsPromoteDialogOpen,
        confirmDialogIsOpen: currentConfirmDialogIsOpen,
        showGrid: currentShowGrid,
        snapToGrid: currentSnapToGrid,
      } = keyboardStateRef.current;

      // Read current callbacks from ref
      const callbacks = keyboardCallbacksRef.current;

      // Disable canvas keyboard shortcuts during text editing
      // (text input handles its own keyboard events)
      if (currentEditingElementId) return;

      // Don't handle shortcuts when focus is on input fields or dialogs are open
      // (isInputFocused already computed above for spacebar handling)
      if (isInputFocused) return;
      if (currentIsPromoteDialogOpen || currentConfirmDialogIsOpen) return;

      // Escape: deselect all and switch to select tool
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedElementId(null);
        setSelectedElementIds(new Set());
        setSelectedGroupId(null);
        setCurrentTool("select");
        return;
      }

      // Ctrl/Cmd+\: Toggle documentation panel
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        callbacks.toggleDocPanel();
        return;
      }

      // Tool shortcuts (single letter without modifiers)
      // Skip if a text element is selected - let type-to-edit handle it instead
      const selectedTextElement = currentSelectedElementId
        ? currentElements.find(el => el.id === currentSelectedElementId && el.type === "text")
        : null;
      const isTextElementSelected = selectedTextElement && selectedTextElement.locked !== true;

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isTextElementSelected) {
        switch (e.key.toLowerCase()) {
          case "v":
            setCurrentTool("select");
            return;
          case "r":
            setCurrentTool("rectangle");
            return;
          case "o":
            setCurrentTool("ellipse");
            return;
          case "d":
            setCurrentTool("diamond");
            return;
          case "a":
            setCurrentTool("arrow");
            return;
          case "l":
            setCurrentTool("line");
            return;
          case "p":
            setCurrentTool("freedraw");
            return;
          case "t":
            setCurrentTool("text");
            return;
          // View shortcuts
          case "g":
            // Toggle grid visibility
            callbacks.setShowGrid(!currentShowGrid);
            return;
          // Color shortcuts
          case "s":
            // Open stroke color picker
            setStrokePickerOpen(true);
            setFillPickerOpen(false);
            return;
          case "f":
            // Open fill color picker
            setFillPickerOpen(true);
            setStrokePickerOpen(false);
            return;
          // Layer shortcuts
          case "h":
            // Toggle visibility of selected element(s)
            if (currentSelectedElementId || currentSelectedElementIds.size > 0) {
              e.preventDefault();
              const idsToToggle = currentSelectedElementIds.size > 0
                ? Array.from(currentSelectedElementIds)
                : [currentSelectedElementId!];
              idsToToggle.forEach(id => callbacks.toggleElementVisibility(id));
            }
            return;
        }
      }

      // "?" key (Shift + /) to show keyboard shortcuts
      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // Shift+G: Toggle snap to grid
      if (e.key === "G" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        callbacks.setSnapToGrid(!currentSnapToGrid);
        return;
      }

      // Ctrl/Cmd+A: Select all elements
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (currentElements.length > 0) {
          setSelectedElementIds(new Set(currentElements.map((el) => el.id)));
          setSelectedElementId(currentElements[0].id);
        }
        return;
      }

      // Ctrl/Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        callbacks.performUndo();
        return;
      }

      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key === "Z" && e.shiftKey)
      ) {
        e.preventDefault();
        callbacks.performRedo();
        return;
      }

      // Ctrl/Cmd+C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        callbacks.copySelectedElements();
        return;
      }

      // Ctrl/Cmd+V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        callbacks.pasteElements();
        return;
      }

      // Ctrl/Cmd+D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        callbacks.duplicateSelectedElements();
        return;
      }

      // Zoom shortcuts: Ctrl/Cmd++ to zoom in, Ctrl/Cmd+- to zoom out, Ctrl/Cmd+0 to reset
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        callbacks.zoomIn();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        callbacks.zoomOut();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        callbacks.resetZoom();
        return;
      }

      // Arrow key navigation: move selected element(s)
      // Shift+Arrow moves by 10px, plain Arrow moves by 1px
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // Only handle if we have selected elements (not instances)
        if (currentSelectedElementId || currentSelectedElementIds.size > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          let dx = 0;
          let dy = 0;

          switch (e.key) {
            case "ArrowUp": dy = -step; break;
            case "ArrowDown": dy = step; break;
            case "ArrowLeft": dx = -step; break;
            case "ArrowRight": dx = step; break;
          }

          callbacks.nudgeSelectedElements(dx, dy);
        }
        return;
      }

      // Tab / Shift+Tab: Cycle through elements for selection (accessibility)
      if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only handle Tab when canvas is focused and we're not in a dialog
        if (currentElements.length > 0) {
          e.preventDefault();
          callbacks.cycleElementSelection(e.shiftKey);
        }
        return;
      }

      // Layer controls
      // Ctrl/Cmd+]: Bring forward
      if ((e.ctrlKey || e.metaKey) && e.key === "]" && !e.shiftKey) {
        e.preventDefault();
        callbacks.bringForward();
        return;
      }
      // Ctrl/Cmd+[: Send backward
      if ((e.ctrlKey || e.metaKey) && e.key === "[" && !e.shiftKey) {
        e.preventDefault();
        callbacks.sendBackward();
        return;
      }
      // Ctrl/Cmd+Shift+]: Bring to front
      if ((e.ctrlKey || e.metaKey) && e.key === "}" && e.shiftKey) {
        e.preventDefault();
        callbacks.bringToFront();
        return;
      }
      // Ctrl/Cmd+Shift+[: Send to back
      if ((e.ctrlKey || e.metaKey) && e.key === "{" && e.shiftKey) {
        e.preventDefault();
        callbacks.sendToBack();
        return;
      }
      // Ctrl/Cmd+L: Toggle lock of selected element(s)
      if ((e.ctrlKey || e.metaKey) && e.key === "l" && !e.shiftKey) {
        if (currentSelectedElementId || currentSelectedElementIds.size > 0) {
          e.preventDefault();
          const idsToToggle = currentSelectedElementIds.size > 0
            ? Array.from(currentSelectedElementIds)
            : [currentSelectedElementId!];
          idsToToggle.forEach(id => callbacks.toggleElementLock(id));
        }
        return;
      }

      // Check for Ctrl/Cmd+G to create group (needs multiple elements selected)
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && !e.shiftKey) {
        if (currentSelectedElementIds.size >= 2) {
          e.preventDefault();
          callbacks.createElementGroup();
        }
        return;
      }

      // Check for Ctrl/Cmd+Shift+G to ungroup
      if ((e.ctrlKey || e.metaKey) && e.key === "G" && e.shiftKey) {
        e.preventDefault();
        // Find if any selected element is in a user group
        const selectedElement = currentSelectedElementId
          ? currentElements.find((el) => el.id === currentSelectedElementId)
          : null;

        if (selectedElement?.elementGroupId) {
          callbacks.ungroupElements(selectedElement.elementGroupId);
        } else if (selectedElement?.groupId) {
          // Also allow ungrouping component groups with this shortcut
          callbacks.ungroupComponent(selectedElement.groupId);
        }
        return;
      }

      // Check for Ctrl/Cmd+Shift+C to promote group to component
      if ((e.ctrlKey || e.metaKey) && e.key === "C" && e.shiftKey) {
        // Find if any selected element is in a user group
        const selectedElement = currentSelectedElementId
          ? currentElements.find((el) => el.id === currentSelectedElementId)
          : null;

        if (selectedElement?.elementGroupId) {
          e.preventDefault();
          callbacks.startPromoteGroupToComponent(selectedElement.elementGroupId);
        }
        return;
      }

      // Text formatting shortcuts (when text element is selected)
      if (currentSelectedElementId) {
        const selectedElement = currentElements.find(
          (el) => el.id === currentSelectedElementId,
        );
        if (selectedElement?.type === "text") {
          const textEl = selectedElement as TextElement;

          // Ctrl/Cmd+B: Toggle bold
          if ((e.ctrlKey || e.metaKey) && e.key === "b") {
            e.preventDefault();
            const newWeight = textEl.fontWeight === "bold" ? "normal" : "bold";
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? { ...el, fontWeight: newWeight, preset: undefined }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+I: Toggle italic
          if ((e.ctrlKey || e.metaKey) && e.key === "i") {
            e.preventDefault();
            const newStyle =
              textEl.fontStyle === "italic" ? "normal" : "italic";
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? { ...el, fontStyle: newStyle }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Shift+L: Align left
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "L") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? { ...el, textAlign: "left" as const }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Shift+E: Align center
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? { ...el, textAlign: "center" as const }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Shift+R: Align right
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "R") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? { ...el, textAlign: "right" as const }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Alt+1: Apply H1 preset
          if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "1") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? {
                      ...el,
                      fontSize: 32,
                      fontWeight: "bold" as const,
                      lineHeight: Math.round(32 * 1.2),
                      preset: "heading1" as const,
                    }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Alt+2: Apply H2 preset
          if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "2") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? {
                      ...el,
                      fontSize: 24,
                      fontWeight: "bold" as const,
                      lineHeight: Math.round(24 * 1.25),
                      preset: "heading2" as const,
                    }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Alt+3: Apply H3 preset
          if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "3") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? {
                      ...el,
                      fontSize: 20,
                      fontWeight: "bold" as const,
                      lineHeight: Math.round(20 * 1.3),
                      preset: "heading3" as const,
                    }
                  : el,
              ),
            );
            return;
          }

          // Ctrl/Cmd+Alt+0: Apply Body preset
          if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "0") {
            e.preventDefault();
            setElements(
              currentElements.map((el) =>
                el.id === currentSelectedElementId
                  ? {
                      ...el,
                      fontSize: 16,
                      fontWeight: "normal" as const,
                      lineHeight: Math.round(16 * 1.5),
                      preset: "body" as const,
                    }
                  : el,
              ),
            );
            return;
          }

          // Enter: Enter edit mode for text element (accessibility - WCAG 2.1.1)
          if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            if (textEl.locked !== true) {
              e.preventDefault();
              callbacks.enterEditMode(textEl);
            }
            return;
          }

          // Type-to-edit: Printable character starts editing and replaces content
          // Matches Excalidraw behavior - typing on selected text replaces it
          if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            textEl.locked !== true
          ) {
            e.preventDefault();
            setEditingElementId(textEl.id);
            setEditingText(e.key);
            setIsNewTextElement(false);
            // Focus input after React renders it
            if (textFocusTimeoutRef.current) {
              clearTimeout(textFocusTimeoutRef.current);
            }
            textFocusTimeoutRef.current = setTimeout(() => {
              textInputRef.current?.focus();
              // Move cursor to end (after the typed character)
              if (textInputRef.current) {
                const len = textInputRef.current.value.length;
                textInputRef.current.setSelectionRange(len, len);
              }
            }, 0);
            return;
          }
        }
      }

      // Handle instance deletion
      if (currentSelectedInstanceId) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          callbacks.deleteComponentInstance(currentSelectedInstanceId);
        }
        return;
      }

      // Only handle deletion if an element is selected
      if (!currentSelectedElementId) return;

      const element = currentElements.find((el) => el.id === currentSelectedElementId);
      if (!element) return;

      // Check for Delete or Backspace key (both behave identically)
      if (e.key === "Delete" || e.key === "Backspace") {
        // Prevent default browser behavior (e.g., navigate back)
        e.preventDefault();

        // Handle multi-selection deletion (including groups)
        if (currentSelectedElementIds.size > 1) {
          // Collect all selected elements
          const selectedElements = currentElements.filter((el) =>
            currentSelectedElementIds.has(el.id)
          );

          // Collect unique group IDs from selected elements
          const componentGroupIds = new Set<string>();
          const elementGroupIds = new Set<string>();
          let ungroupedCount = 0;

          selectedElements.forEach((el) => {
            if (el.groupId) {
              componentGroupIds.add(el.groupId);
            } else if (el.elementGroupId) {
              elementGroupIds.add(el.elementGroupId);
            } else {
              ungroupedCount++;
            }
          });

          const totalGroups = componentGroupIds.size + elementGroupIds.size;

          // If any groups are involved, show confirmation dialog
          if (totalGroups > 0) {
            // Build message parts
            const parts: string[] = [];
            if (componentGroupIds.size > 0) {
              parts.push(
                `${componentGroupIds.size} component${componentGroupIds.size > 1 ? "s" : ""}`
              );
            }
            if (elementGroupIds.size > 0) {
              parts.push(
                `${elementGroupIds.size} group${elementGroupIds.size > 1 ? "s" : ""}`
              );
            }
            if (ungroupedCount > 0) {
              parts.push(
                `${ungroupedCount} element${ungroupedCount > 1 ? "s" : ""}`
              );
            }

            const title =
              totalGroups === 1 && ungroupedCount === 0
                ? componentGroupIds.size > 0
                  ? "Delete component?"
                  : "Delete group?"
                : "Delete selection?";

            const message =
              `This will delete ${parts.join(" and ")}. This action cannot be undone.`;

            callbacks.showConfirmDialog(
              title,
              message,
              () => {
                // Re-read current state for the callback (state may have changed)
                const latestState = keyboardStateRef.current;
                const latestCallbacks = keyboardCallbacksRef.current;
                latestCallbacks.recordSnapshot(); // Record for undo

                // Use fresh selectedElementIds from ref (not stale closure variable)
                const freshSelectedIds = latestState.selectedElementIds;

                // Recompute group IDs from fresh state to ensure consistency
                const freshSelectedElements = latestState.elements.filter((el) =>
                  freshSelectedIds.has(el.id)
                );
                const freshComponentGroupIds = new Set<string>();
                const freshElementGroupIds = new Set<string>();

                freshSelectedElements.forEach((el) => {
                  if (el.groupId) {
                    freshComponentGroupIds.add(el.groupId);
                  } else if (el.elementGroupId) {
                    freshElementGroupIds.add(el.elementGroupId);
                  }
                });

                // Delete all selected elements
                setElements(
                  latestState.elements.filter((el) => !freshSelectedIds.has(el.id))
                );

                // Clean up component group records
                if (freshComponentGroupIds.size > 0) {
                  setComponentGroups(
                    latestState.componentGroups.filter(
                      (grp) => !freshComponentGroupIds.has(grp.id)
                    )
                  );
                }

                // Clean up element group records
                if (freshElementGroupIds.size > 0) {
                  setElementGroups(
                    latestState.elementGroups.filter(
                      (grp) => !freshElementGroupIds.has(grp.id)
                    )
                  );
                }

                // Clear all selections
                setSelectedElementIds(new Set());
                setSelectedElementId(null);
                setSelectedGroupId(null);

                latestCallbacks.announce(
                  `Deleted ${freshSelectedElements.length} element${freshSelectedElements.length !== 1 ? "s" : ""}`
                );
              },
              "danger"
            );
          } else {
            // No groups, just delete individual elements
            callbacks.recordSnapshot(); // Record for undo
            const count = currentSelectedElementIds.size;
            setElements(
              currentElements.filter((el) => !currentSelectedElementIds.has(el.id))
            );
            setSelectedElementIds(new Set());
            setSelectedElementId(null);
            callbacks.announce(`Deleted ${count} elements`);
          }
        }
        // If element is in a user-created element group, delete entire group
        else if (element.elementGroupId) {
          const groupId = element.elementGroupId;
          callbacks.showConfirmDialog(
            "Delete group?",
            "This will delete all elements in this group. This action cannot be undone.",
            () => {
              keyboardCallbacksRef.current.deleteElementGroup(groupId);
            },
            "danger",
          );
        }
        // If element is in a component group, delete entire component group with confirmation
        else if (element.groupId) {
          const componentName = element.componentType || "grouped";
          const groupId = element.groupId;
          callbacks.showConfirmDialog(
            `Delete ${componentName} component?`,
            "This will delete the entire component and all its elements. This action cannot be undone.",
            () => {
              keyboardCallbacksRef.current.deleteGroup(groupId);
            },
            "danger",
          );
        }
        // Remove single element from state
        else {
          callbacks.recordSnapshot(); // Record for undo
          const elementType = element.type;

          // Collect IDs to delete (element + any bound text if container)
          const idsToDelete = new Set<string>([currentSelectedElementId]);

          // If this is a container with bound text, also delete the bound text
          if (isContainerElement(element) && element.boundElements) {
            element.boundElements.forEach(be => {
              idsToDelete.add(be.id);
            });
          }

          // If this is a bound text element, remove reference from container
          const textEl = element as TextElement;
          if (textEl.containerId) {
            // Update the container to remove the bound element reference
            const container = currentElements.find(el => el.id === textEl.containerId);
            if (container && container.boundElements) {
              const updatedContainer = {
                ...container,
                boundElements: container.boundElements.filter(be => be.id !== currentSelectedElementId)
              };
              setElements(
                currentElements
                  .filter((el) => !idsToDelete.has(el.id))
                  .map(el => el.id === textEl.containerId ? updatedContainer : el)
              );
              setSelectedElementId(null);
              callbacks.announce(`Deleted ${elementType}`);
              return;
            }
          }

          setElements(currentElements.filter((el) => !idsToDelete.has(el.id)));
          setSelectedElementId(null);
          callbacks.announce(`Deleted ${elementType}`);
        }
      }

      // Check for 'G' key (without modifiers) to ungroup component groups (legacy behavior)
      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (element.groupId) {
          e.preventDefault();
          callbacks.ungroupComponent(element.groupId);
        } else if (element.elementGroupId) {
          e.preventDefault();
          callbacks.ungroupElements(element.elementGroupId);
        }
      }
    };

    // Handle spacebar release for pan mode
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceHeld(false);
        // Also stop panning if it was started by spacebar
        setIsPanning(false);
        setLastPanPoint(null);
      }
    };

    // Add event listeners
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  // Empty dependency array - all state and callbacks are accessed via refs
  // This completely eliminates event listener re-registration on state changes
  // The refs (keyboardStateRef and keyboardCallbacksRef) are updated synchronously
  // during render, so the handler always has access to current values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get instances for the current frame
  const getFrameInstances = useCallback(
    (frameId: string): ComponentInstance[] => {
      return componentInstances.filter(i => i.frameId === frameId);
    },
    [componentInstances]
  );

  // Get instances of a specific component
  const getComponentInstances = useCallback(
    (componentId: string): ComponentInstance[] => {
      return componentInstances.filter(i => i.componentId === componentId);
    },
    [componentInstances]
  );

  // Count instances of a component across all frames
  const countComponentInstances = useCallback(
    (componentId: string): number => {
      return componentInstances.filter(i => i.componentId === componentId).length;
    },
    [componentInstances]
  );

  // Delete a user component (with warning if instances exist)
  const deleteUserComponent = (componentId: string, flattenInstances: boolean = false) => {
    const instanceCount = countComponentInstances(componentId);
    const component = userComponents.find(c => c.id === componentId);
    if (!component) return;

    recordSnapshot(); // Record for undo

    if (flattenInstances && instanceCount > 0) {
      // Flatten instances to regular element groups
      const instancesToFlatten = componentInstances.filter(i => i.componentId === componentId);

      for (const instance of instancesToFlatten) {
        // Create new elements from master definition
        const newGroupId = generateElementGroupId();
        const newElements: CanvasElement[] = component.masterElements.map(def => {
          const baseElement = {
            id: generateId(),
            x: instance.x + def.offsetX,
            y: instance.y + def.offsetY,
            width: def.width,
            height: def.height,
            rotation: def.rotation,
            semanticTag: def.semanticTag,
            description: def.description,
            elementGroupId: newGroupId,
            style: def.style,
          };

          // Apply overrides if any
          const override = instance.overrides?.find(o => o.elementId === def.id);

          if (def.type === 'text') {
            return {
              ...baseElement,
              type: 'text' as const,
              content: override?.property === 'content' ? String(override.value) : (def.content || ''),
              fontSize: def.fontSize,
              fontWeight: def.fontWeight,
              fontStyle: def.fontStyle,
              textAlign: def.textAlign,
              lineHeight: def.lineHeight,
              preset: def.preset,
              autoWidth: def.autoWidth,
            };
          } else if (def.type === 'arrow') {
            return {
              ...baseElement,
              type: 'arrow' as const,
              startX: instance.x + (def.startX || 0),
              startY: instance.y + (def.startY || 0),
              endX: instance.x + (def.endX || 0),
              endY: instance.y + (def.endY || 0),
            };
          } else if (def.type === 'line') {
            return {
              ...baseElement,
              type: 'line' as const,
              startX: instance.x + (def.startX || 0),
              startY: instance.y + (def.startY || 0),
              endX: instance.x + (def.endX || 0),
              endY: instance.y + (def.endY || 0),
            };
          } else if (def.type === 'freedraw') {
            return {
              ...baseElement,
              type: 'freedraw' as const,
              points: (def.points || []).map(p => ({
                x: instance.x + p.x,
                y: instance.y + p.y,
              })),
            };
          } else {
            return {
              ...baseElement,
              type: def.type,
            } as CanvasElement;
          }
        });

        // Add elements to the frame
        setFrames(prevFrames =>
          prevFrames.map(frame =>
            frame.id === instance.frameId
              ? { ...frame, elements: [...frame.elements, ...newElements] }
              : frame
          )
        );

        // Create element group for the flattened elements
        const newElementGroup: ElementGroup = {
          id: newGroupId,
          elementIds: newElements.map(el => el.id),
          frameId: instance.frameId,
          createdAt: new Date().toISOString(),
        };
        setElementGroups(prev => [...prev, newElementGroup]);
      }
    }

    // Remove all instances of this component
    setComponentInstances(componentInstances.filter(i => i.componentId !== componentId));

    // Remove the component
    setUserComponents(userComponents.filter(c => c.id !== componentId));

    // Clear selection if the deleted component's instance was selected
    if (selectedInstanceId) {
      const selectedInstance = componentInstances.find(i => i.id === selectedInstanceId);
      if (selectedInstance?.componentId === componentId) {
        setSelectedInstanceId(null);
      }
    }
  };

  // Update a user component's master definition
  const updateUserComponent = (componentId: string, updates: Partial<UserComponent>) => {
    recordSnapshot(); // Record for undo
    setUserComponents(
      userComponents.map(c =>
        c.id === componentId
          ? { ...c, ...updates, updatedAt: new Date().toISOString() }
          : c
      )
    );
  };

  // Rename a user component
  const renameUserComponent = (componentId: string, newName: string) => {
    updateUserComponent(componentId, { name: newName });
  };

  // Apply an override to an instance
  const applyInstanceOverride = (
    instanceId: string,
    elementId: string,
    property: string,
    value: string | number | boolean
  ) => {
    recordSnapshot(); // Record for undo
    setComponentInstances(
      componentInstances.map(instance => {
        if (instance.id !== instanceId) return instance;

        const existingOverrides = instance.overrides || [];
        const existingIndex = existingOverrides.findIndex(
          o => o.elementId === elementId && o.property === property
        );

        let newOverrides: ComponentOverride[];
        if (existingIndex >= 0) {
          // Update existing override
          newOverrides = existingOverrides.map((o, i) =>
            i === existingIndex ? { ...o, value } : o
          );
        } else {
          // Add new override
          newOverrides = [...existingOverrides, { elementId, property, value }];
        }

        return { ...instance, overrides: newOverrides };
      })
    );
  };

  // Reset an override on an instance
  const resetInstanceOverride = (instanceId: string, elementId: string, property: string) => {
    recordSnapshot(); // Record for undo
    setComponentInstances(
      componentInstances.map(instance => {
        if (instance.id !== instanceId) return instance;

        const newOverrides = (instance.overrides || []).filter(
          o => !(o.elementId === elementId && o.property === property)
        );

        return { ...instance, overrides: newOverrides.length > 0 ? newOverrides : undefined };
      })
    );
  };

  // ============================================================================
  // Documentation Panel Handlers (Phase 1)
  // ============================================================================

  // Handler for changing frame notes
  // Uses functional update to avoid stale closure issues
  const handleFrameNotesChange = (notes: string) => {
    setFrames((prevFrames) =>
      prevFrames.map(frame => {
        if (frame.id === activeFrameId) {
          return {
            ...frame,
            documentation: {
              ...frame.documentation,
              notes,
              elementAnnotations: frame.documentation?.elementAnnotations || {},
            },
          };
        }
        return frame;
      })
    );
  };

  // Handler for changing element annotation
  // Uses functional update to avoid stale closure issues
  const handleElementAnnotationChange = (annotation: ElementAnnotation) => {
    if (!selectedElementId) return;

    setFrames((prevFrames) =>
      prevFrames.map(frame => {
        if (frame.id === activeFrameId) {
          return {
            ...frame,
            documentation: {
              notes: frame.documentation?.notes || '',
              elementAnnotations: {
                ...frame.documentation?.elementAnnotations,
                [selectedElementId]: annotation,
              },
            },
          };
        }
        return frame;
      })
    );
  };

  // Get current element annotation
  const currentElementAnnotation = selectedElementId
    ? activeFrame?.documentation?.elementAnnotations?.[selectedElementId]
    : undefined;

  // Calculate annotation count for documentation panel badge
  const annotatedCount = (() => {
    const annotations = activeFrame?.documentation?.elementAnnotations;
    if (!annotations) return 0;
    // Count elements with at least one non-empty annotation field
    return Object.values(annotations).filter(
      a => a.description.trim() || a.behavior.trim() || a.edgeCases.trim()
    ).length;
  })();

  // Get selected text element for unified style bar (null if non-text or nothing selected)
  const selectedTextElement = selectedElementId
    ? (elements.find(el => el.id === selectedElementId && el.type === 'text') as TextElement | undefined) || null
    : null;

  // Get context-sensitive modifier key hints for the status bar
  const getModifierHints = (): { tool: string; hints: string[] } => {
    // Determine display name for current tool
    const toolNames: Record<Tool, string> = {
      select: 'Select',
      rectangle: 'Rectangle',
      ellipse: 'Ellipse',
      diamond: 'Diamond',
      arrow: 'Arrow',
      line: 'Line',
      text: 'Text',
      freedraw: 'Freedraw',
    };
    const tool = toolNames[currentTool];

    // Context-specific hints based on current operation
    if (isRotating) {
      return { tool, hints: ['Shift: Snap to 15°'] };
    }

    if (resizeHandle) {
      return { tool, hints: ['Shift: Maintain aspect ratio'] };
    }

    // When actively drawing shapes
    if (isDrawing && startPoint) {
      if (currentTool === 'rectangle' || currentTool === 'ellipse' || currentTool === 'diamond') {
        return { tool, hints: ['Shift: Constrain to square/circle'] };
      }
      if (currentTool === 'arrow' || currentTool === 'line') {
        return { tool, hints: ['Shift: Snap to 45° angles'] };
      }
    }

    // Tool-specific hints when not actively drawing
    switch (currentTool) {
      case 'select':
        if (selectedElementId || selectedElementIds.size > 0) {
          return {
            tool,
            hints: [
              'Shift+Click: Multi-select',
              'Shift+Arrow: Move 10px',
              'Shift+Tab: Cycle backwards',
            ]
          };
        }
        return { tool, hints: ['Shift+Click: Add to selection'] };
      case 'rectangle':
      case 'ellipse':
      case 'diamond':
        return { tool, hints: ['Shift: Constrain to square/circle'] };
      case 'arrow':
      case 'line':
        return { tool, hints: ['Shift: Snap to 45° angles'] };
      case 'text':
        return { tool, hints: ['Click to place text'] };
      case 'freedraw':
        return { tool, hints: ['Click and drag to draw'] };
      default:
        return { tool, hints: [] };
    }
  };

  const statusBarInfo = getModifierHints();

  // Calculate selection info for UnifiedStyleBar
  const getSelectionInfo = () => {
    // Gather all selected element IDs including group elements
    const allSelectedIds = new Set<string>();
    if (selectedElementId) allSelectedIds.add(selectedElementId);
    selectedElementIds.forEach(id => allSelectedIds.add(id));

    // Add elements from selected component group
    if (selectedGroupId) {
      const groupElements = getGroupElements(selectedGroupId);
      groupElements.forEach(el => allSelectedIds.add(el.id));
    }

    // Add elements from selected element group
    const selectedEl = selectedElementId ? elements.find(el => el.id === selectedElementId) : null;
    if (selectedEl?.elementGroupId) {
      const groupElements = getElementGroupElements(selectedEl.elementGroupId);
      groupElements.forEach(el => allSelectedIds.add(el.id));
    }

    const count = allSelectedIds.size;
    if (count === 0) {
      // No selection - return current colors for new elements
      return {
        count: 0,
        strokeColor: currentStrokeColor,
        fillColor: currentFillColor,
      };
    }

    // Get styles from all selected elements
    const selectedElements = elements.filter(el => allSelectedIds.has(el.id));
    const strokeColors = new Set<string>();
    const fillColors = new Set<string>();

    selectedElements.forEach(el => {
      strokeColors.add(el.style?.strokeColor || DEFAULT_STROKE_COLOR);
      fillColors.add(el.style?.fillColor || DEFAULT_FILL_COLOR);
    });

    return {
      count,
      strokeColor: strokeColors.size === 1 ? [...strokeColors][0] : 'mixed' as const,
      fillColor: fillColors.size === 1 ? [...fillColors][0] : 'mixed' as const,
    };
  };

  const selectionInfo = getSelectionInfo();

  // Helper to gather all currently selected element IDs (includes group elements)
  const getAllSelectedElementIds = (): Set<string> => {
    const allSelectedIds = new Set<string>();
    if (selectedElementId) allSelectedIds.add(selectedElementId);
    selectedElementIds.forEach(id => allSelectedIds.add(id));

    // Add elements from selected component group
    if (selectedGroupId) {
      const groupElements = getGroupElements(selectedGroupId);
      groupElements.forEach(el => allSelectedIds.add(el.id));
    }

    // Add elements from selected element group
    const selectedEl = selectedElementId ? elements.find(el => el.id === selectedElementId) : null;
    if (selectedEl?.elementGroupId) {
      const groupElements = getElementGroupElements(selectedEl.elementGroupId);
      groupElements.forEach(el => allSelectedIds.add(el.id));
    }

    return allSelectedIds;
  };

  // Handler for updating selected element's stroke color (supports multi-selection and groups)
  const handleStrokeColorChange = (color: string) => {
    setCurrentStrokeColor(color);

    const allSelectedIds = getAllSelectedElementIds();

    if (allSelectedIds.size > 0) {
      recordSnapshot();
      setElements(elements.map(el => {
        if (allSelectedIds.has(el.id)) {
          return {
            ...el,
            style: {
              ...el.style,
              strokeColor: color,
              fillColor: el.style?.fillColor || DEFAULT_FILL_COLOR,
            },
          };
        }
        return el;
      }));
    }
  };

  // Handler for updating selected element's fill color (supports multi-selection and groups)
  const handleFillColorChange = (color: string) => {
    setCurrentFillColor(color);

    const allSelectedIds = getAllSelectedElementIds();

    if (allSelectedIds.size > 0) {
      recordSnapshot();
      setElements(elements.map(el => {
        if (allSelectedIds.has(el.id)) {
          return {
            ...el,
            style: {
              ...el.style,
              strokeColor: el.style?.strokeColor || DEFAULT_STROKE_COLOR,
              fillColor: color,
            },
          };
        }
        return el;
      }));
    }
  };

  // Calculate canGroup: multiple ungrouped elements selected
  const canGroup = (() => {
    if (selectedElementIds.size < 2) return false;
    const selectedElements = elements.filter((el) => selectedElementIds.has(el.id));
    // Can't group if any element is already in a group
    return !selectedElements.some((el) => el.elementGroupId || el.groupId);
  })();

  // Calculate canUngroup: selected element is in a group
  const canUngroup = (() => {
    const selectedElement = selectedElementId
      ? elements.find((el) => el.id === selectedElementId)
      : null;
    if (!selectedElement) return false;
    return !!(selectedElement.elementGroupId || selectedElement.groupId);
  })();

  // Handler for grouping selected elements from UnifiedStyleBar
  const handleGroup = () => {
    if (canGroup) {
      createElementGroup();
    }
  };

  // Handler for ungrouping elements from UnifiedStyleBar
  const handleUngroup = () => {
    const selectedElement = selectedElementId
      ? elements.find((el) => el.id === selectedElementId)
      : null;
    if (!selectedElement) return;

    if (selectedElement.elementGroupId) {
      ungroupElements(selectedElement.elementGroupId);
    } else if (selectedElement.groupId) {
      ungroupComponent(selectedElement.groupId);
    }
  };

  // Handler for updating selected text element from UnifiedStyleBar
  const handleStyleBarTextUpdate = (updates: Partial<TextElement>) => {
    if (!selectedElementId) return;
    recordSnapshot();
    setElements(
      elements.map((el) =>
        el.id === selectedElementId && el.type === "text"
          ? { ...el, ...updates }
          : el,
      ),
    );
  };

  // Component insertion handler
  const handleInsertComponent = (template: ComponentTemplate) => {
    // Insert at visible canvas center (accounting for zoom and pan)
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    let insertX = 500;
    let insertY = 400;

    if (canvas && container) {
      // Calculate the center of the visible area in canvas coordinates
      const containerRect = container.getBoundingClientRect();
      const centerScreenX = containerRect.width / 2;
      const centerScreenY = containerRect.height / 2;
      // Convert screen center to canvas coordinates using zoom and pan
      insertX = (centerScreenX - pan.x) / zoom;
      insertY = (centerScreenY - pan.y) / zoom;
    }

    // Spawn template as ElementGroup (teal "Group" styling, not purple "Component: X")
    const group = createTemplateAsElementGroup(template, insertX, insertY);

    // Select all elements in the newly created group
    setSelectedElementIds(new Set(group.elementIds));
    setSelectedElementId(null);
    setSelectedGroupId(null); // Clear component group selection

    // Switch to select tool
    setCurrentTool("select");
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 min-w-[900px]">
      {/* Screen reader announcements for canvas operations */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {screenReaderAnnouncement}
      </div>

      {/* Skip link for keyboard users to bypass navigation */}
      <a
        href="#main-canvas"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to canvas
      </a>

      {/* Left sidebar: Frames */}
      <FrameList
        isExpanded={frameListExpanded}
        onToggle={toggleFrameList}
        frames={frames}
        activeFrameId={activeFrameId}
        onSwitchFrame={handleSwitchFrame}
        onCreateFrame={handleCreateFrame}
        onRenameFrame={handleRenameFrame}
        onDeleteFrame={handleDeleteFrame}
        onRequestDeleteFrame={handleRequestDeleteFrame}
        onReorderFrames={handleReorderFrames}
      />

      <Toolbar currentTool={currentTool} onToolChange={setCurrentTool} />

      <div className="flex-1 flex flex-col">
        <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {activeFrame?.name || "WireFlow"}
          </h1>
          <div className="flex items-center gap-4">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
              <button
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Zoom out (Ctrl+-)"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded min-w-[50px] text-center transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                title="Reset zoom (Ctrl+0)"
                aria-label="Reset zoom to 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title="Zoom in (Ctrl++)"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
            {/* Undo/Redo controls */}
            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-2">
              <button
                onClick={performUndo}
                disabled={!historyManager.canUndo}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent text-zinc-600 dark:text-zinc-400"
                title={`Undo (Ctrl+Z)${historyManager.undoCount > 0 ? ` - ${historyManager.undoCount} available` : ''}`}
                aria-label={`Undo${historyManager.undoCount > 0 ? `, ${historyManager.undoCount} steps available` : ', no actions to undo'}`}
              >
                <Undo2 size={16} strokeWidth={1.5} />
              </button>
              <span
                className="text-xs text-zinc-400 dark:text-zinc-500 min-w-[32px] text-center tabular-nums"
                aria-label={`${historyManager.undoCount} undos, ${historyManager.redoCount} redos available`}
                title={`${historyManager.undoCount} undo${historyManager.undoCount !== 1 ? 's' : ''} / ${historyManager.redoCount} redo${historyManager.redoCount !== 1 ? 's' : ''}`}
              >
                {historyManager.undoCount}/{historyManager.redoCount}
              </span>
              <button
                onClick={performRedo}
                disabled={!historyManager.canRedo}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent text-zinc-600 dark:text-zinc-400"
                title={`Redo (Ctrl+Y)${historyManager.redoCount > 0 ? ` - ${historyManager.redoCount} available` : ''}`}
                aria-label={`Redo${historyManager.redoCount > 0 ? `, ${historyManager.redoCount} steps available` : ', no actions to redo'}`}
              >
                <Redo2 size={16} strokeWidth={1.5} />
              </button>
            </div>
            {/* Grid controls */}
            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-2">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-1 text-xs rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  showGrid
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                title="Toggle grid (G)"
                aria-label="Toggle grid"
                aria-pressed={showGrid}
              >
                Grid
              </button>
              <button
                onClick={() => {
                  const newValue = !snapToGrid;
                  setSnapToGrid(newValue);
                  announce(newValue ? 'Snap to grid enabled' : 'Snap to grid disabled');
                }}
                className={`px-2 py-1 text-xs rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                  snapToGrid
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                title="Toggle snap to grid (Shift+G)"
                aria-label="Toggle snap to grid"
                aria-pressed={snapToGrid}
              >
                Snap{snapToGrid && ' ✓'}
              </button>
            </div>
            {/* Save status indicator */}
            {saveStatus && (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-all duration-300 ${
                  saveStatus === 'saved'
                    ? 'text-green-600 dark:text-green-400'
                    : saveStatus === 'saving'
                      ? 'text-zinc-500 dark:text-zinc-400'
                      : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                }`}
                role="status"
                aria-live="polite"
                title={saveStatus === 'error' ? saveError || 'Save failed' : undefined}
              >
                {saveStatus === 'saving' && (
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                    <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
                {saveStatus === 'saved' && (
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                  </svg>
                )}
                {saveStatus === 'error' && (
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7.25 4.5a.75.75 0 011.5 0v3.25a.75.75 0 01-1.5 0V4.5zm.75 7.25a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                )}
                <span>
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}
                </span>
              </div>
            )}
            {/* Welcome/help button */}
            <button
              onClick={() => setWelcomeOpen(true)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              title="Show welcome guide"
              aria-label="Open welcome guide"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </button>
            {/* Keyboard shortcuts button */}
            <button
              onClick={() => setShortcutsOpen(true)}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              title="View keyboard shortcuts (press ?)"
              aria-label="Open keyboard shortcuts panel, press question mark key"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <line x1="6" y1="10" x2="6.01" y2="10" />
                <line x1="10" y1="10" x2="10.01" y2="10" />
                <line x1="14" y1="10" x2="14.01" y2="10" />
                <line x1="18" y1="10" x2="18.01" y2="10" />
                <line x1="7" y1="14" x2="17" y2="14" />
              </svg>
            </button>
            <ThemeToggle />
            <ImageExport elements={elements} frameName={activeFrame?.name || 'wireflow'} />
            <ExportButton frames={frames} />
          </div>
        </div>

        {/* Unified Style Bar - always visible, consolidates color and text formatting */}
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
          <UnifiedStyleBar
            strokeColor={selectionInfo.strokeColor}
            fillColor={selectionInfo.fillColor}
            selectionCount={selectionInfo.count}
            onStrokeColorChange={handleStrokeColorChange}
            onFillColorChange={handleFillColorChange}
            selectedTextElement={selectedTextElement}
            onTextUpdate={handleStyleBarTextUpdate}
            strokePickerOpen={strokePickerOpen}
            fillPickerOpen={fillPickerOpen}
            onStrokePickerOpenChange={setStrokePickerOpen}
            onFillPickerOpenChange={setFillPickerOpen}
            canGroup={canGroup}
            canUngroup={canUngroup}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
          />
        </div>

        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-hidden relative bg-white dark:bg-zinc-900"
        >
          <canvas
            id="main-canvas"
            ref={canvasRef}
            width={2000}
            height={2000}
            className={
              isPanning
                ? "absolute inset-0 cursor-grabbing"
                : isSpaceHeld
                  ? "absolute inset-0 cursor-grab" // Space held, ready to pan
                  : currentTool === "select"
                    ? hoveredHandle
                      ? `absolute inset-0 ${(() => {
                          // Show not-allowed cursor if the selected element is locked
                          const selectedEl = elements.find(el => el.id === selectedElementId);
                          if (selectedEl?.locked) return "cursor-not-allowed";
                          return getHandleCursor(hoveredHandle);
                        })()}`
                      : hoveredElementId
                        ? `absolute inset-0 ${(() => {
                            const hoveredEl = elements.find(el => el.id === hoveredElementId);
                            if (hoveredEl?.locked) return "cursor-not-allowed";
                            return hoveredEl?.type === "text" ? "cursor-text" : "cursor-move";
                          })()}`
                        : "absolute inset-0 cursor-default"
                    : "absolute inset-0" // Tool-specific cursor applied via style
            }
            style={
              // Apply tool-specific custom cursors for drawing tools
              currentTool !== "select" && !isPanning && !isSpaceHeld
                ? { cursor: getToolCursor(currentTool) }
                : undefined
            }
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDragOver={(e) => {
              // Allow drop for user components
              if (e.dataTransfer.types.includes('application/x-user-component')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(e) => {
              const componentId = e.dataTransfer.getData('application/x-user-component');
              if (componentId) {
                e.preventDefault();
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  const screenX = e.clientX - rect.left;
                  const screenY = e.clientY - rect.top;
                  const canvasCoords = screenToCanvas(screenX, screenY);
                  const instance = instantiateComponent(componentId, canvasCoords.x, canvasCoords.y, activeFrameId);
                  if (instance) {
                    setSelectedInstanceId(instance.id);
                    setSelectedElementId(null);
                    setSelectedElementIds(new Set());
                    setCurrentTool('select');
                  }
                }
              }
            }}
            onMouseLeave={() => {
              setHoveredElementId(null);
              setHoveredHandle(null);
              if (isPanning) {
                setIsPanning(false);
                setLastPanPoint(null);
              }
            }}
            onDoubleClick={handleDoubleClick}
            tabIndex={0}
            role="application"
            aria-label={`Canvas for ${activeFrame?.name || "wireframing"}. Use the toolbar to select drawing tools. Press Delete to remove selected elements, Ctrl+Z to undo, Ctrl+Y to redo.`}
          />
          {/* Inline text editing overlay */}
          {editingElementId &&
            (() => {
              const editingElement = elements.find(
                (el) => el.id === editingElementId,
              );
              if (!editingElement || editingElement.type !== "text")
                return null;

              const textEl = editingElement as TextElement;
              const isBoundText = !!textEl.containerId;

              // Get typography properties with defaults
              const fontSize = textEl.fontSize || 16;
              const fontWeight = textEl.fontWeight || "normal";
              const fontStyle = textEl.fontStyle || "normal";
              const textAlign = textEl.textAlign || "left";
              const lineHeight =
                textEl.lineHeight || Math.round(fontSize * 1.5);

              // Calculate vertical offset to match canvas text rendering exactly
              // Canvas draws baseline at element.y + fontSize
              // Text top (ascenders) is approximately at element.y + fontSize * 0.2
              // CSS textarea adds half-leading above text: (lineHeight - fontSize) / 2
              // To align: textarea_top + halfLeading = element.y + fontSize * 0.2
              // Therefore: textarea_top = element.y + fontSize * 0.2 - halfLeading
              const halfLeading = (lineHeight - fontSize) / 2;
              const verticalOffset = fontSize * 0.2 - halfLeading;

              // Calculate height based on line count (for auto-grow)
              // Height needs only bottom padding since top is handled by position offset
              const lineCount = Math.max(1, editingText.split("\n").length);
              const calculatedHeight = Math.max(
                lineHeight + TEXT_PADDING,
                lineCount * lineHeight + TEXT_PADDING,
              );

              // For bound text, position within the container
              let textareaX = editingElement.x;
              let textareaY = editingElement.y + verticalOffset;
              let textareaWidth = editingElement.width;

              if (isBoundText && textEl.containerId) {
                const container = elements.find(el => el.id === textEl.containerId);
                if (container) {
                  // Position textarea centered within container
                  const containerPadding = 8;
                  textareaWidth = container.width - containerPadding * 2;
                  textareaX = container.x + containerPadding;

                  // Calculate vertical centering for bound text
                  const totalTextHeight = lineCount * lineHeight;
                  textareaY = container.y + (container.height - totalTextHeight) / 2 + verticalOffset;
                }
              }

              // IMPORTANT: Use the stored element width to prevent position jump on edit entry
              // The onChange handler updates element.width during typing for auto-width behavior
              // This ensures the textarea matches the canvas-rendered position exactly
              const currentWidth = isBoundText ? textareaWidth : editingElement.width;

              return (
                <textarea
                  ref={textInputRef}
                  value={editingText}
                  onChange={(e) => {
                    setEditingText(e.target.value);
                    // Update element width in real-time for auto-width (not for bound text)
                    if (textEl.autoWidth !== false && !isBoundText) {
                      const newWidth = calculateAutoWidth(e.target.value || " ", {
                        fontSize,
                        fontWeight,
                        fontStyle,
                      });
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === editingElementId
                            ? { ...el, width: Math.max(MIN_TEXT_WIDTH, newWidth) }
                            : el
                        )
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    // Enter for newline (default), Shift+Enter or Ctrl/Cmd+Enter commits
                    if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitTextEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      commitTextEdit(); // Escape now commits (Excalidraw behavior)
                    } else if (e.key === "Tab") {
                      // Tab exits text editing and moves focus
                      e.preventDefault();
                      commitTextEdit();
                      // Return focus to canvas for continued navigation
                      canvasRef.current?.focus();
                    }
                    e.stopPropagation(); // Prevent canvas keyboard handlers
                  }}
                  onBlur={commitTextEdit}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  data-gramm="false"
                  className="absolute resize-none overflow-hidden border border-blue-400/50 rounded-sm"
                  style={{
                    left: textareaX * zoom + pan.x,
                    // Offset top to match canvas baseline rendering
                    top: textareaY * zoom + pan.y,
                    width: currentWidth * zoom,
                    minWidth: MIN_TEXT_WIDTH * zoom,
                    height: (calculatedHeight - verticalOffset) * zoom,
                    fontFamily: "sans-serif",
                    fontSize: `${fontSize * zoom}px`,
                    fontWeight: fontWeight,
                    fontStyle: fontStyle,
                    textAlign: textAlign,
                    lineHeight: `${lineHeight * zoom}px`,
                    // Horizontal padding matches canvas TEXT_PADDING
                    // Vertical padding set to 0 - positioning handled by top offset
                    paddingLeft: `${TEXT_PADDING * zoom}px`,
                    paddingRight: `${TEXT_PADDING * zoom}px`,
                    paddingTop: 0,
                    paddingBottom: `${TEXT_PADDING * zoom}px`,
                    // Fully transparent - WYSIWYG
                    background: "transparent",
                    color: textEl.style?.strokeColor || canvasTheme.sketch,
                    caretColor: canvasTheme.selected,
                    // Remove default styling
                    margin: 0,
                    boxShadow: "none",
                    WebkitAppearance: "none",
                  }}
                  aria-label="Edit text element"
                />
              );
            })()}

          {/* Status Bar - shows current tool and modifier key hints */}
          <div
            className="absolute bottom-0 left-0 right-0 h-7 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-700 flex items-center px-3 text-xs text-zinc-600 dark:text-zinc-400 pointer-events-none select-none"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Current tool indicator */}
            <span className="font-medium text-zinc-700 dark:text-zinc-300 mr-4">
              {statusBarInfo.tool}
            </span>

            {/* Modifier hints */}
            {statusBarInfo.hints.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 dark:text-zinc-500">|</span>
                {statusBarInfo.hints.map((hint, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && <span className="text-zinc-300 dark:text-zinc-600 mx-1">·</span>}
                    {hint}
                  </span>
                ))}
              </div>
            )}

            {/* Zoom level on the right side */}
            <span className="ml-auto text-zinc-500 dark:text-zinc-500">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      </div>

      <ComponentPanel
        onInsertComponent={handleInsertComponent}
        userComponents={userComponents}
        onInsertUserComponent={(componentId, x, y) => {
          const instance = instantiateComponent(componentId, x, y, activeFrameId);
          if (instance) {
            setSelectedInstanceId(instance.id);
            setSelectedElementId(null);
            setSelectedElementIds(new Set());
            setCurrentTool('select');
          }
        }}
        onDeleteUserComponent={(componentId) => {
          const instanceCount = countComponentInstances(componentId);
          if (instanceCount > 0) {
            showConfirmDialog(
              'Delete component?',
              `This component is used in ${instanceCount} place${instanceCount > 1 ? 's' : ''}. Do you want to flatten instances to groups before deleting?`,
              () => deleteUserComponent(componentId, true),
              'warning'
            );
          } else {
            deleteUserComponent(componentId, false);
          }
        }}
        onRenameUserComponent={renameUserComponent}
        getInstanceCount={countComponentInstances}
        isExpanded={componentPanelExpanded}
        onToggle={toggleComponentPanel}
        selectedElementGroupId={
          selectedElementId
            ? elements.find((el) => el.id === selectedElementId)?.elementGroupId
            : null
        }
        onConvertGroupToComponent={startPromoteGroupToComponent}
      />

      {/* Documentation Panel - Phase 1 */}
      <DocumentationPanel
        isExpanded={docPanelExpanded}
        onToggle={toggleDocPanel}
        frameName={activeFrame?.name || 'Untitled'}
        frameDocumentation={activeFrame?.documentation}
        onFrameNotesChange={handleFrameNotesChange}
        selectedElementId={selectedElementId}
        elementAnnotation={currentElementAnnotation}
        onElementAnnotationChange={handleElementAnnotationChange}
        totalElements={elements.length}
        annotatedCount={annotatedCount}
      />

      {/* Layers Panel */}
      <LayersPanel
        isExpanded={layersPanelExpanded}
        onToggle={toggleLayersPanel}
        elements={elements}
        componentGroups={componentGroups}
        elementGroups={elementGroups}
        userComponents={userComponents}
        componentInstances={componentInstances.filter(i => i.frameId === activeFrameId)}
        selectedElementId={selectedElementId}
        selectedElementIds={selectedElementIds}
        selectedInstanceId={selectedInstanceId}
        onSelectElement={(elementId, addToSelection) => {
          if (addToSelection) {
            setSelectedElementIds(prev => new Set([...prev, elementId]));
          } else {
            setSelectedElementId(elementId);
            setSelectedElementIds(new Set());
          }
          setSelectedInstanceId(null); // Clear instance selection when selecting element
        }}
        onSelectGroup={(groupId, groupType) => {
          // Select all elements in the group
          const groupElementIds = groupType === 'component'
            ? componentGroups.find(g => g.id === groupId)?.elementIds || []
            : elementGroups.find(g => g.id === groupId)?.elementIds || [];

          if (groupElementIds.length > 0) {
            setSelectedElementId(groupElementIds[0]);
            setSelectedElementIds(new Set(groupElementIds));
            setSelectedInstanceId(null); // Clear instance selection when selecting group
          }
        }}
        onSelectInstance={(instanceId) => {
          setSelectedInstanceId(instanceId);
          setSelectedElementId(null); // Clear element selection when selecting instance
          setSelectedElementIds(new Set());
        }}
        onReorderElements={reorderElement}
        onToggleVisibility={toggleElementVisibility}
        onToggleLock={toggleElementLock}
        onRenameElement={renameElement}
      />

      {/* Right panel collapsed strip - shows toggle buttons when panels are collapsed */}
      <RightPanelStrip
        layersPanelExpanded={layersPanelExpanded}
        onToggleLayersPanel={toggleLayersPanel}
        componentPanelExpanded={componentPanelExpanded}
        onToggleComponentPanel={toggleComponentPanel}
        docPanelExpanded={docPanelExpanded}
        onToggleDocPanel={toggleDocPanel}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => {
          confirmDialog.onConfirm();
          closeConfirmDialog();
        }}
        onCancel={closeConfirmDialog}
      />

      {/* Keyboard Shortcuts Panel */}
      <KeyboardShortcutsPanel
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* Welcome Modal - auto-shows for first-time users, can be manually re-opened */}
      <WelcomeModal
        externalOpen={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
      />

      {/* Promote to Component Dialog */}
      {isPromoteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 animate-fade-in"
            onClick={handlePromoteDialogCancel}
            aria-hidden="true"
          />

          {/* Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-dialog-title"
            aria-describedby="promote-dialog-description"
            onKeyDown={(e) => {
              // Handle escape at dialog level
              if (e.key === 'Escape') {
                e.preventDefault();
                handlePromoteDialogCancel();
              }

              // Trap focus within dialog
              if (e.key !== 'Tab') return;

              const focusableElements = e.currentTarget.querySelectorAll(
                'input:not([disabled]), button:not([disabled])'
              );

              if (!focusableElements || focusableElements.length === 0) return;

              const firstElement = focusableElements[0] as HTMLElement;
              const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

              if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
              } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
              }
            }}
            className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in"
          >
            <div className="p-6">
              {/* Title */}
              <h2
                id="promote-dialog-title"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2"
              >
                Create Component
              </h2>

              {/* Description */}
              <p
                id="promote-dialog-description"
                className="text-sm text-zinc-600 dark:text-zinc-400 mb-4"
              >
                Enter a name for your new component. It will be added to your component library.
              </p>

              {/* Input with label */}
              <div className="mb-6">
                <label htmlFor="component-name-input" className="sr-only">
                  Component name
                </label>
                <input
                  id="component-name-input"
                  type="text"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  placeholder="Component name"
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newComponentName.trim()) {
                        handlePromoteDialogConfirm();
                      }
                    }
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handlePromoteDialogCancel}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePromoteDialogConfirm}
                  disabled={!newComponentName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                  Create Component
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

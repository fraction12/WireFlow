"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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
} from "@/lib/types";
import { saveWorkspace, loadWorkspace } from "@/lib/persistence";
import {
  MIN_TEXT_WIDTH,
  TEXT_PADDING,
  calculateAutoWidth,
} from "@/lib/textMeasurement";
import { useHistoryManager } from "@/lib/useHistory";
import { Toolbar } from "./Toolbar";
import { ExportButton } from "./ExportButton";
import { FrameList } from "./FrameList";
import { ComponentPanel } from "./ComponentPanel";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useToast } from "./ui/Toast";
import { ThemeToggle } from "./ThemeToggle";
import { TextToolbar } from "./TextToolbar";
import { ImageExport } from "./ImageExport";

// Snapshot type for undo/redo history
interface HistorySnapshot {
  frames: Frame[];
  componentGroups: ComponentGroup[];
  elementGroups: ElementGroup[];
}

// Canvas color theme interface
interface CanvasTheme {
  sketch: string;
  selected: string;
  selectedBg: string;
  hover: string;
  tagged: string;
  group: string;
  marqueeFill: string;
  marqueeStroke: string;
  handle: string;
  handleFill: string;
}

// Get canvas colors from CSS variables
function getCanvasTheme(): CanvasTheme {
  if (typeof window === "undefined") {
    // Default light theme for SSR
    return {
      sketch: "#6b7280",
      selected: "#3b82f6",
      selectedBg: "rgba(59, 130, 246, 0.08)",
      hover: "#4b5563",
      tagged: "#10b981",
      group: "#8b5cf6",
      marqueeFill: "rgba(59, 130, 246, 0.1)",
      marqueeStroke: "#3b82f6",
      handle: "#3b82f6",
      handleFill: "#ffffff",
    };
  }

  const styles = getComputedStyle(document.documentElement);
  return {
    sketch: styles.getPropertyValue("--canvas-sketch").trim() || "#6b7280",
    selected: styles.getPropertyValue("--canvas-selected").trim() || "#3b82f6",
    selectedBg:
      styles.getPropertyValue("--canvas-selected-bg").trim() ||
      "rgba(59, 130, 246, 0.08)",
    hover: styles.getPropertyValue("--canvas-hover").trim() || "#4b5563",
    tagged: styles.getPropertyValue("--canvas-tagged").trim() || "#10b981",
    group: styles.getPropertyValue("--canvas-group").trim() || "#8b5cf6",
    marqueeFill:
      styles.getPropertyValue("--canvas-marquee-fill").trim() ||
      "rgba(59, 130, 246, 0.1)",
    marqueeStroke:
      styles.getPropertyValue("--canvas-marquee-stroke").trim() || "#3b82f6",
    handle: styles.getPropertyValue("--canvas-handle").trim() || "#3b82f6",
    handleFill:
      styles.getPropertyValue("--canvas-handle-fill").trim() || "#ffffff",
  };
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>(getCanvasTheme);
  const { addToast } = useToast();

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

  const showConfirmDialog = (
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
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // Constants for sketch rendering and interaction
  const SKETCH_AMPLITUDE = 1.5;
  const SEGMENT_DISTANCE = 20;
  const ARROW_HEAD_LENGTH = 15;
  const HANDLE_SIZE = 8;
  const HANDLE_TOLERANCE = 5;
  const MIN_ELEMENT_SIZE = 20;
  const ROTATION_HANDLE_OFFSET = 25; // Distance above element for rotation handle

  // Generate unique IDs (using substring instead of deprecated substr)
  const generateId = () =>
    `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const generateFrameId = () =>
    `frame_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

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
  const setElements = (
    newElements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[]),
  ) => {
    const elementsArray =
      typeof newElements === "function" ? newElements(elements) : newElements;

    setFrames(
      frames.map((frame) =>
        frame.id === activeFrameId
          ? { ...frame, elements: elementsArray }
          : frame,
      ),
    );
  };

  // Tool and interaction state
  const [currentTool, setCurrentTool] = useState<Tool>("select");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
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

  // Undo/Redo history manager
  const historyManager = useHistoryManager<HistorySnapshot>(100);

  // Record a snapshot for undo (call before making changes)
  const recordSnapshot = useCallback(() => {
    historyManager.recordSnapshot({
      frames: JSON.parse(JSON.stringify(frames)),
      componentGroups: JSON.parse(JSON.stringify(componentGroups)),
      elementGroups: JSON.parse(JSON.stringify(elementGroups)),
    });
  }, [frames, componentGroups, elementGroups, historyManager]);

  // Perform undo
  const performUndo = useCallback(() => {
    const currentState: HistorySnapshot = {
      frames: JSON.parse(JSON.stringify(frames)),
      componentGroups: JSON.parse(JSON.stringify(componentGroups)),
      elementGroups: JSON.parse(JSON.stringify(elementGroups)),
    };
    const previousState = historyManager.undo(currentState);
    if (previousState) {
      setFrames(previousState.frames);
      setComponentGroups(previousState.componentGroups);
      setElementGroups(previousState.elementGroups);
      // Clear selections after undo for safety
      setSelectedElementId(null);
      setSelectedElementIds(new Set());
      setSelectedGroupId(null);
    }
  }, [frames, componentGroups, elementGroups, historyManager]);

  // Perform redo
  const performRedo = useCallback(() => {
    const currentState: HistorySnapshot = {
      frames: JSON.parse(JSON.stringify(frames)),
      componentGroups: JSON.parse(JSON.stringify(componentGroups)),
      elementGroups: JSON.parse(JSON.stringify(elementGroups)),
    };
    const nextState = historyManager.redo(currentState);
    if (nextState) {
      setFrames(nextState.frames);
      setComponentGroups(nextState.componentGroups);
      setElementGroups(nextState.elementGroups);
      // Clear selections after redo for safety
      setSelectedElementId(null);
      setSelectedElementIds(new Set());
      setSelectedGroupId(null);
    }
  }, [frames, componentGroups, elementGroups, historyManager]);

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

  // Track if current selection was made by clicking (for Backspace delete behavior)
  // Backspace should only delete an element if the user clicked to select it,
  // not after exiting text edit mode or other interactions
  const [selectedByClick, setSelectedByClick] = useState(false);

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

  // Freehand drawing state
  const [freedrawPoints, setFreedrawPoints] = useState<{ x: number; y: number }[]>([]);

  // Grid and snap settings
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const GRID_SIZE = 20; // Grid cell size in pixels

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
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

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

  // Persistence: track if initial load has completed
  const hasLoadedRef = useRef(false);

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
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const savedState = loadWorkspace();
    if (savedState && savedState.frames.length > 0) {
      setFrames(savedState.frames);
      setComponentGroups(savedState.componentGroups);
      setElementGroups(savedState.elementGroups || []);
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
    if (!hasLoadedRef.current) return;

    const timeoutId = setTimeout(() => {
      saveWorkspace({
        version: 1,
        frames,
        componentGroups,
        elementGroups,
        activeFrameId,
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [frames, componentGroups, elementGroups, activeFrameId]);

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

  // Sketch-style rendering helpers
  const getRandomOffset = (
    base: number,
    seed: number,
    amplitude: number = SKETCH_AMPLITUDE,
  ): number => {
    // Use seed for deterministic randomness based on position
    const pseudo = Math.sin(seed * 12.9898 + base * 78.233) * 43758.5453;
    return (pseudo - Math.floor(pseudo)) * amplitude - amplitude / 2;
  };

  const drawSketchLine = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number = 0,
  ) => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    // Safety: Skip drawing degenerate (zero-length) lines
    if (distance < 1) return;

    const segments = Math.max(3, Math.floor(distance / SEGMENT_DISTANCE));

    ctx.beginPath();
    ctx.moveTo(x1, y1);

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;

      // Add controlled wobble perpendicular to the line direction
      const dx = x2 - x1;
      const dy = y2 - y1;
      const perpX = -dy / distance;
      const perpY = dx / distance;

      const wobble = getRandomOffset(i, seed + i * 7);
      const wobbledX = x + perpX * wobble;
      const wobbledY = y + perpY * wobble;

      ctx.lineTo(wobbledX, wobbledY);
    }

    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawSketchRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    seed: number = 0,
  ) => {
    // Draw four sides with slight variations
    drawSketchLine(ctx, x, y, x + width, y, seed); // Top
    drawSketchLine(ctx, x + width, y, x + width, y + height, seed + 1); // Right
    drawSketchLine(ctx, x + width, y + height, x, y + height, seed + 2); // Bottom
    drawSketchLine(ctx, x, y + height, x, y, seed + 3); // Left
  };

  const drawSketchEllipse = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    seed: number = 0,
  ) => {
    // Draw ellipse with sketch-style wobble
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width / 2;
    const radiusY = height / 2;
    const segments = Math.max(24, Math.floor((radiusX + radiusY) / 4));

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const baseX = centerX + radiusX * Math.cos(angle);
      const baseY = centerY + radiusY * Math.sin(angle);

      // Add wobble perpendicular to the ellipse curve
      const wobble = getRandomOffset(i, seed + i * 7);
      const wobbledX = baseX + wobble * Math.cos(angle);
      const wobbledY = baseY + wobble * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(wobbledX, wobbledY);
      } else {
        ctx.lineTo(wobbledX, wobbledY);
      }
    }
    ctx.closePath();
    ctx.stroke();
  };

  // Draw a diamond (rhombus) shape with sketch-style wobble
  const drawSketchDiamond = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    seed: number = 0,
  ) => {
    // Diamond points: top, right, bottom, left (center-aligned)
    const topX = x + width / 2;
    const topY = y;
    const rightX = x + width;
    const rightY = y + height / 2;
    const bottomX = x + width / 2;
    const bottomY = y + height;
    const leftX = x;
    const leftY = y + height / 2;

    // Draw the four sides with sketch-style wobble
    drawSketchLine(ctx, topX, topY, rightX, rightY, seed); // Top-right edge
    drawSketchLine(ctx, rightX, rightY, bottomX, bottomY, seed + 1); // Bottom-right edge
    drawSketchLine(ctx, bottomX, bottomY, leftX, leftY, seed + 2); // Bottom-left edge
    drawSketchLine(ctx, leftX, leftY, topX, topY, seed + 3); // Top-left edge
  };

  // Draw a freehand path with smooth curves
  const drawFreedraw = (
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
  ) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Use quadratic curves for smooth rendering
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    // Draw to the last point
    if (points.length > 1) {
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    ctx.stroke();
  };

  // Wrap text to fit within a given width, returning an array of lines
  // Handles both explicit newlines and word-wrapping
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string[] => {
    const paragraphs = text.split("\n");
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (paragraph === "") {
        lines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines.length > 0 ? lines : [""];
  };

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
      ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
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

    // Draw all elements
    elements.forEach((element) => {
      // Use theme colors for sketch style
      ctx.strokeStyle = canvasTheme.sketch;
      ctx.fillStyle = canvasTheme.sketch;
      ctx.lineWidth = 1.5;
      ctx.font = "16px sans-serif";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Highlight selected elements with theme selected color (single or multi-select)
      const isSelected =
        element.id === selectedElementId || selectedElementIds.has(element.id);
      if (isSelected) {
        ctx.strokeStyle = canvasTheme.selected;
        ctx.fillStyle = canvasTheme.selected;
      }

      // Highlight semantically tagged elements with theme tagged color
      if (element.semanticTag) {
        ctx.strokeStyle = canvasTheme.tagged;
        ctx.fillStyle = canvasTheme.tagged;
      }

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
        drawSketchRect(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          seed,
        );
      } else if (element.type === "ellipse") {
        drawSketchEllipse(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          seed,
        );
      } else if (element.type === "diamond") {
        drawSketchDiamond(
          ctx,
          element.x,
          element.y,
          element.width,
          element.height,
          seed,
        );
      } else if (element.type === "text") {
        const textEl = element as TextElement;
        const padding = TEXT_PADDING;

        // Determine visual state for text element
        const isHovered =
          element.id === hoveredElementId && currentTool === "select";
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

        // Draw subtle background for selected text elements
        if (isSelected) {
          ctx.fillStyle = canvasTheme.selectedBg;
          ctx.fillRect(element.x, element.y, element.width, element.height);
          // Restore fill style for text
          ctx.fillStyle = canvasTheme.selected;
        }

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

        // Render each line of wrapped text
        lines.forEach((line, index) => {
          ctx.fillText(line, textX, element.y + fontSize + index * lineHeight);
        });

        // Reset text align for other elements
        ctx.textAlign = "left";

        // Visual state handling for text border
        if (isSelected) {
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
        } else if (isHovered) {
          // Hovered: subtle darker gray to indicate interactivity
          ctx.strokeStyle = canvasTheme.hover;
          ctx.lineWidth = 1.5;
          drawSketchRect(
            ctx,
            element.x,
            element.y,
            element.width,
            element.height,
            seed,
          );
        } else {
          // Default: standard sketch-style border with lighter opacity for subtlety
          ctx.save();
          ctx.globalAlpha = 0.7; // Make not-selected text borders more subtle
          drawSketchRect(
            ctx,
            element.x,
            element.y,
            element.width,
            element.height,
            seed,
          );
          ctx.restore();
        }
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
      } else if (element.type === "freedraw") {
        // Draw freehand path
        const freedrawEl = element as FreedrawElement;
        drawFreedraw(ctx, freedrawEl.points);
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
        } else if (element.type !== "text" && element.type !== "freedraw") {
          // Corner handles for rectangles, ellipses, and diamonds
          const centerX = element.x + element.width / 2;
          const centerY = element.y + element.height / 2;
          const elemRotation = element.rotation || 0;

          // Transform corner handles based on element rotation
          const corners = [
            { dx: -element.width / 2, dy: -element.height / 2 }, // NW
            { dx: element.width / 2, dy: -element.height / 2 }, // NE
            { dx: -element.width / 2, dy: element.height / 2 }, // SW
            { dx: element.width / 2, dy: element.height / 2 }, // SE
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

          // Draw rotation handle (above the element, with connector line)
          const rotHandleDistFromCenter = element.height / 2 + ROTATION_HANDLE_OFFSET;
          const rotHandleX = centerX + Math.sin(elemRotation) * rotHandleDistFromCenter;
          const rotHandleY = centerY - Math.cos(elemRotation) * rotHandleDistFromCenter;

          // Draw connector line from top edge to rotation handle
          const topEdgeY = centerY - element.height / 2;
          const topEdgeX = centerX;
          const rotatedTopX = centerX + (topEdgeX - centerX) * Math.cos(elemRotation) - (topEdgeY - centerY) * Math.sin(elemRotation);
          const rotatedTopY = centerY + (topEdgeX - centerX) * Math.sin(elemRotation) + (topEdgeY - centerY) * Math.cos(elemRotation);

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
    });

    // Draw component group selection outlines
    componentGroups.forEach((group) => {
      if (group.id === selectedGroupId) {
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
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]); // Dashed for group outline
        const groupSeed = parseInt(group.id.split("_")[1]) || 0;
        drawSketchRect(
          ctx,
          minX - 5,
          minY - 5,
          maxX - minX + 10,
          maxY - minY + 10,
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
      // Check if any element in this group is selected
      const groupElements = getElementGroupElements(group.id);
      const hasSelectedElement = groupElements.some(
        (el) => el.id === selectedElementId || selectedElementIds.has(el.id),
      );

      if (hasSelectedElement && groupElements.length > 0) {
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
        ctx.strokeStyle = canvasTheme.selected; // Blue for user groups
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]); // Dashed for group outline
        const groupSeed = parseInt(group.id.split("_")[1]) || 0;
        drawSketchRect(
          ctx,
          minX - 5,
          minY - 5,
          maxX - minX + 10,
          maxY - minY + 10,
          groupSeed,
        );
        ctx.setLineDash([]);

        // Draw group label
        ctx.fillStyle = canvasTheme.selected;
        ctx.font = "12px sans-serif";
        ctx.fillText("Group", minX, minY - 10);
      }
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

        ctx.strokeStyle = canvasTheme.selected;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(minX - 3, minY - 3, maxX - minX + 6, maxY - minY + 6);
        ctx.setLineDash([]);
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
    isMarqueeSelecting,
    marqueeStart,
    marqueeEnd,
    canvasTheme,
    zoom,
    pan,
  ]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Find element at point
  const findElementAtPoint = (
    x: number,
    y: number,
  ): { element: CanvasElement | null; groupId?: string } => {
    // Search in reverse order (top element first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
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
  // Returns handle ID: 'nw'|'ne'|'sw'|'se' for rectangles, 'start'|'end' for arrows/lines.
  // Text elements have no resize handles (they use auto-width).
  const getResizeHandle = (
    x: number,
    y: number,
    element: CanvasElement,
  ): string | null => {
    // Text elements don't have resize handles - they use auto-width
    if (element.type === "text") {
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

    // Corner handles for rectangles and ellipses
    const handles = {
      nw: { x: element.x, y: element.y },
      ne: { x: element.x + element.width, y: element.y },
      sw: { x: element.x, y: element.y + element.height },
      se: { x: element.x + element.width, y: element.y + element.height },
    };

    for (const [key, pos] of Object.entries(handles)) {
      if (
        Math.abs(x - pos.x) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
        Math.abs(y - pos.y) <= HANDLE_SIZE + HANDLE_TOLERANCE
      ) {
        return key;
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

    // Rotation handle is above the element, rotated with the element
    const handleDistFromCenter = element.height / 2 + ROTATION_HANDLE_OFFSET;
    const handleX = centerX + Math.sin(rotation) * handleDistFromCenter;
    const handleY = centerY - Math.cos(rotation) * handleDistFromCenter;

    return (
      Math.abs(x - handleX) <= HANDLE_SIZE + HANDLE_TOLERANCE &&
      Math.abs(y - handleY) <= HANDLE_SIZE + HANDLE_TOLERANCE
    );
  };

  // Snap coordinate to grid
  const snapToGridCoord = (value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
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
  const enterEditMode = (element: TextElement) => {
    setEditingElementId(element.id);
    setEditingText(element.content || "");
    setIsNewTextElement(false); // Existing element, not new
    setSelectedByClick(false); // Clear click-selection flag (prevents Backspace delete after editing)
    // Focus input after React renders it
    setTimeout(() => {
      textInputRef.current?.focus();
      // Move cursor to end instead of selecting all (Excalidraw behavior)
      if (textInputRef.current) {
        const len = textInputRef.current.value.length;
        textInputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

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
      setElements(elements.filter((el) => el.id !== editingElementId));
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
    let finalWidth = editingElement.width;
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

    setElements(
      elements.map((el) =>
        el.id === editingElementId && el.type === "text"
          ? ({
              ...el,
              content: trimmedText,
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
      // Edit existing text element
      enterEditMode(clickedElement as TextElement);
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

      setTimeout(() => {
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

    // Middle mouse button or spacebar held starts panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
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
      const { element: clickedElement, groupId } = findElementAtPoint(x, y);

      if (clickedElement) {
        setSelectedByClick(true); // Mark as selected by click (enables Backspace delete)

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
        setSelectedElementId(clickedElement.id);

        // If element is in a user-created group, select all group members
        if (elementGroup) {
          setSelectedElementIds(new Set(elementGroup.elementIds));
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

        // Check if click is on a resize handle (only for non-grouped elements)
        const isInAnyGroup = groupId || clickedElement.elementGroupId;

        // Check rotation handle first (only for rotatable elements)
        const onRotationHandle = !isInAnyGroup && isOnRotationHandle(x, y, clickedElement);

        if (onRotationHandle) {
          // Enter rotation mode
          recordSnapshot(); // Record for undo before rotation
          const centerX = clickedElement.x + clickedElement.width / 2;
          const centerY = clickedElement.y + clickedElement.height / 2;
          const mouseAngle = Math.atan2(y - centerY, x - centerX);
          setIsRotating(true);
          setRotationStart({
            initialAngle: clickedElement.rotation || 0,
            elementCenterX: centerX,
            elementCenterY: centerY,
            startMouseAngle: mouseAngle,
          });
          setIsDrawing(true);
        }

        const handle = !isInAnyGroup && !onRotationHandle
          ? getResizeHandle(x, y, clickedElement)
          : null;

        if (handle) {
          // Enter resize mode: capture snapshot of initial bounds and pointer position.
          // This snapshot is the single source of truth for resize calculations.
          recordSnapshot(); // Record for undo before resize
          setResizeHandle(handle);
          const snapshot: typeof resizeSnapshot = {
            initialBounds: {
              x: clickedElement.x,
              y: clickedElement.y,
              width: clickedElement.width,
              height: clickedElement.height,
            },
            pointerOrigin: { x, y },
          };
          // For arrows and lines, also capture initial endpoints
          if (
            clickedElement.type === "arrow" ||
            clickedElement.type === "line"
          ) {
            const lineEl = clickedElement as ArrowElement | LineElement;
            snapshot.arrowEndpoints = {
              startX: lineEl.startX,
              startY: lineEl.startY,
              endX: lineEl.endX,
              endY: lineEl.endY,
            };
          }
          setResizeSnapshot(snapshot);
          setIsDrawing(true);
        } else if (!onRotationHandle) {
          // Start dragging
          recordSnapshot(); // Record for undo before drag
          setDragOffset({ x: x - clickedElement.x, y: y - clickedElement.y });
          setIsDrawing(true);
        }
      } else {
        // Clicked on empty space - start marquee selection
        // Clear previous selections unless Shift is held (to add to selection)
        if (!e.shiftKey) {
          setSelectedElementId(null);
          setSelectedElementIds(new Set());
          setSelectedGroupId(null);
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
        setTimeout(() => {
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
        } else if (element.type !== "arrow" && element.type !== "line") {
          // RECTANGLE/TEXT RESIZE MODE: Compute new bounds from the snapshot.
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

          setElements(
            elements.map((el) => {
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
            }),
          );
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
          // Move single element with optional grid snap
          const rawX = x - dragOffset.x;
          const rawY = y - dragOffset.y;
          const newX = snapToGridCoord(rawX);
          const newY = snapToGridCoord(rawY);
          const snapDx = newX - element.x;
          const snapDy = newY - element.y;

          setElements(
            elements.map((el) => {
              if (el.id === selectedElementId) {
                if (el.type === "arrow" || el.type === "line") {
                  // Arrows and lines need endpoint updates when moved
                  const lineEl = el as ArrowElement | LineElement;
                  return {
                    ...lineEl,
                    x: newX,
                    y: newY,
                    startX: lineEl.startX + snapDx,
                    startY: lineEl.startY + snapDy,
                    endX: lineEl.endX + snapDx,
                    endY: lineEl.endY + snapDy,
                  };
                }
                return { ...el, x: newX, y: newY };
              }
              return el;
            }),
          );
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

      ctx.strokeStyle = canvasTheme.sketch;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([8, 4]);

      const previewSeed = Date.now() % 1000;

      if (currentTool === "rectangle") {
        const width = x - startPoint.x;
        const height = y - startPoint.y;
        drawSketchRect(
          ctx,
          startPoint.x,
          startPoint.y,
          width,
          height,
          previewSeed,
        );
      } else if (currentTool === "ellipse") {
        const width = x - startPoint.x;
        const height = y - startPoint.y;
        drawSketchEllipse(
          ctx,
          startPoint.x,
          startPoint.y,
          width,
          height,
          previewSeed,
        );
      } else if (currentTool === "diamond") {
        const width = x - startPoint.x;
        const height = y - startPoint.y;
        drawSketchDiamond(
          ctx,
          width > 0 ? startPoint.x : x,
          height > 0 ? startPoint.y : y,
          Math.abs(width),
          Math.abs(height),
          previewSeed,
        );
      } else if (currentTool === "arrow" || currentTool === "line") {
        // Find snap points for preview
        const startSnap = findNearestSnapPoint(startPoint.x, startPoint.y);
        const endSnap = findNearestSnapPoint(x, y);
        const previewStartX = startSnap ? startSnap.x : startPoint.x;
        const previewStartY = startSnap ? startSnap.y : startPoint.y;
        const previewEndX = endSnap ? endSnap.x : x;
        const previewEndY = endSnap ? endSnap.y : y;

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
        setSelectedByClick(true);
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
      const width = x - startPoint.x;
      const height = y - startPoint.y;

      if (currentTool === "rectangle") {
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
          recordSnapshot(); // Record for undo
          const newElement: RectangleElement = {
            id: generateId(),
            type: "rectangle",
            x: width > 0 ? startPoint.x : x,
            y: height > 0 ? startPoint.y : y,
            width: Math.abs(width),
            height: Math.abs(height),
          };
          setElements([...elements, newElement]);
          setSelectedElementId(newElement.id);
          setCurrentTool("select");
        }
      } else if (currentTool === "ellipse") {
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
          recordSnapshot(); // Record for undo
          const newElement: EllipseElement = {
            id: generateId(),
            type: "ellipse",
            x: width > 0 ? startPoint.x : x,
            y: height > 0 ? startPoint.y : y,
            width: Math.abs(width),
            height: Math.abs(height),
          };
          setElements([...elements, newElement]);
          setSelectedElementId(newElement.id);
          setCurrentTool("select");
        }
      } else if (currentTool === "diamond") {
        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
          recordSnapshot(); // Record for undo
          const newElement: DiamondElement = {
            id: generateId(),
            type: "diamond",
            x: width > 0 ? startPoint.x : x,
            y: height > 0 ? startPoint.y : y,
            width: Math.abs(width),
            height: Math.abs(height),
          };
          setElements([...elements, newElement]);
          setSelectedElementId(newElement.id);
          setCurrentTool("select");
        }
      } else if (currentTool === "arrow") {
        recordSnapshot(); // Record for undo
        // Snap start and end points to nearby elements
        const startSnap = findNearestSnapPoint(startPoint.x, startPoint.y);
        const endSnap = findNearestSnapPoint(x, y);
        const finalStartX = startSnap ? startSnap.x : startPoint.x;
        const finalStartY = startSnap ? startSnap.y : startPoint.y;
        const finalEndX = endSnap ? endSnap.x : x;
        const finalEndY = endSnap ? endSnap.y : y;

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
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
      } else if (currentTool === "line") {
        recordSnapshot(); // Record for undo
        // Snap start and end points to nearby elements
        const startSnap = findNearestSnapPoint(startPoint.x, startPoint.y);
        const endSnap = findNearestSnapPoint(x, y);
        const finalStartX = startSnap ? startSnap.x : startPoint.x;
        const finalStartY = startSnap ? startSnap.y : startPoint.y;
        const finalEndX = endSnap ? endSnap.x : x;
        const finalEndY = endSnap ? endSnap.y : y;

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
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
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
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setCurrentTool("select");
        setFreedrawPoints([]);
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setFreedrawPoints([]);
    setDragOffset(null);
    setResizeHandle(null);
    setResizeSnapshot(null); // Clear resize snapshot on pointer up
    setIsRotating(false);
    setRotationStart(null);
  };

  // Wheel handler for zooming
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Ctrl/Cmd + wheel for zooming
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Zoom in/out based on scroll direction
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoomAtPoint(delta, screenX, screenY);
    }
    // Without modifier, allow normal scroll for pan
    else {
      // Horizontal scroll (shift+wheel) or trackpad pan
      const dx = e.deltaX;
      const dy = e.deltaY;
      setPan((prev) => ({ x: prev.x - dx, y: prev.y - dy }));
    }
  };

  // Copy selected elements to clipboard
  const copySelectedElements = useCallback(() => {
    const elementsToCopy: CanvasElement[] = [];

    // If multiple elements selected, copy all of them
    if (selectedElementIds.size > 0) {
      elements.forEach((el) => {
        if (selectedElementIds.has(el.id)) {
          elementsToCopy.push(JSON.parse(JSON.stringify(el)));
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
                elementsToCopy.push(JSON.parse(JSON.stringify(groupEl)));
              }
            });
          }
        } else {
          elementsToCopy.push(JSON.parse(JSON.stringify(element)));
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
    setSelectedByClick(true);
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
        ...JSON.parse(JSON.stringify(el)),
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

      newElements.push(newElement);
    });

    setElements([...elements, ...newElements]);

    // Select the duplicated elements
    const newIds = new Set(newElements.map((el) => el.id));
    setSelectedElementIds(newIds);
    setSelectedElementId(newElements[0].id);
    setSelectedByClick(true);
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

  // Keyboard event handler for deletion, grouping, and ungrouping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable canvas keyboard shortcuts during text editing
      // (text input handles its own keyboard events)
      if (editingElementId) return;

      // Tool shortcuts (single letter without modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
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
        }
      }

      // Ctrl/Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key === "Z" && e.shiftKey)
      ) {
        e.preventDefault();
        performRedo();
        return;
      }

      // Ctrl/Cmd+C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelectedElements();
        return;
      }

      // Ctrl/Cmd+V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        pasteElements();
        return;
      }

      // Ctrl/Cmd+D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelectedElements();
        return;
      }

      // Zoom shortcuts: Ctrl/Cmd++ to zoom in, Ctrl/Cmd+- to zoom out, Ctrl/Cmd+0 to reset
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoomIn();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }

      // Layer controls
      // Ctrl/Cmd+]: Bring forward
      if ((e.ctrlKey || e.metaKey) && e.key === "]" && !e.shiftKey) {
        e.preventDefault();
        bringForward();
        return;
      }
      // Ctrl/Cmd+[: Send backward
      if ((e.ctrlKey || e.metaKey) && e.key === "[" && !e.shiftKey) {
        e.preventDefault();
        sendBackward();
        return;
      }
      // Ctrl/Cmd+Shift+]: Bring to front
      if ((e.ctrlKey || e.metaKey) && e.key === "}" && e.shiftKey) {
        e.preventDefault();
        bringToFront();
        return;
      }
      // Ctrl/Cmd+Shift+[: Send to back
      if ((e.ctrlKey || e.metaKey) && e.key === "{" && e.shiftKey) {
        e.preventDefault();
        sendToBack();
        return;
      }

      // Check for Ctrl/Cmd+G to create group (needs multiple elements selected)
      if ((e.ctrlKey || e.metaKey) && e.key === "g" && !e.shiftKey) {
        if (selectedElementIds.size >= 2) {
          e.preventDefault();
          createElementGroup();
        }
        return;
      }

      // Check for Ctrl/Cmd+Shift+G to ungroup
      if ((e.ctrlKey || e.metaKey) && e.key === "G" && e.shiftKey) {
        e.preventDefault();
        // Find if any selected element is in a user group
        const selectedElement = selectedElementId
          ? elements.find((el) => el.id === selectedElementId)
          : null;

        if (selectedElement?.elementGroupId) {
          ungroupElements(selectedElement.elementGroupId);
        } else if (selectedElement?.groupId) {
          // Also allow ungrouping component groups with this shortcut
          ungroupComponent(selectedElement.groupId);
        }
        return;
      }

      // Text formatting shortcuts (when text element is selected)
      if (selectedElementId) {
        const selectedElement = elements.find(
          (el) => el.id === selectedElementId,
        );
        if (selectedElement?.type === "text") {
          const textEl = selectedElement as TextElement;

          // Ctrl/Cmd+B: Toggle bold
          if ((e.ctrlKey || e.metaKey) && e.key === "b") {
            e.preventDefault();
            const newWeight = textEl.fontWeight === "bold" ? "normal" : "bold";
            setElements(
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
              elements.map((el) =>
                el.id === selectedElementId
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
        }
      }

      // Only handle deletion if an element is selected
      if (!selectedElementId) return;

      const element = elements.find((el) => el.id === selectedElementId);
      if (!element) return;

      // Check for Delete or Backspace key
      // Backspace only deletes if element was selected by clicking (not after editing text)
      if (e.key === "Delete" || (e.key === "Backspace" && selectedByClick)) {
        // Prevent default browser behavior (e.g., navigate back)
        e.preventDefault();

        // If element is in a user-created element group, delete entire group
        if (element.elementGroupId) {
          const groupId = element.elementGroupId;
          showConfirmDialog(
            "Delete group?",
            "This will delete all elements in this group. This action cannot be undone.",
            () => {
              deleteElementGroup(groupId);
              setSelectedByClick(false);
            },
            "danger",
          );
        }
        // If element is in a component group, delete entire component group with confirmation
        else if (element.groupId) {
          const componentName = element.componentType || "grouped";
          const groupId = element.groupId;
          showConfirmDialog(
            `Delete ${componentName} component?`,
            "This will delete the entire component and all its elements. This action cannot be undone.",
            () => {
              deleteGroup(groupId);
              setSelectedByClick(false);
            },
            "danger",
          );
        }
        // If multiple elements are selected (not in a group), delete all selected
        else if (selectedElementIds.size > 1) {
          recordSnapshot(); // Record for undo
          setElements(elements.filter((el) => !selectedElementIds.has(el.id)));
          setSelectedElementIds(new Set());
          setSelectedElementId(null);
          setSelectedByClick(false);
        }
        // Remove single element from state
        else {
          recordSnapshot(); // Record for undo
          setElements(elements.filter((el) => el.id !== selectedElementId));
          setSelectedElementId(null);
          setSelectedByClick(false);
        }
      }

      // Check for 'G' key (without modifiers) to ungroup component groups (legacy behavior)
      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (element.groupId) {
          e.preventDefault();
          ungroupComponent(element.groupId);
        } else if (element.elementGroupId) {
          e.preventDefault();
          ungroupElements(element.elementGroupId);
        }
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedElementId,
    selectedElementIds,
    elements,
    componentGroups,
    elementGroups,
    editingElementId,
    selectedByClick,
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
  ]);

  // Frame management handlers
  const handleCreateFrame = (type: FrameType) => {
    const newFrame: Frame = {
      id: generateFrameId(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${frames.length + 1}`,
      type,
      elements: [],
      createdAt: new Date().toISOString(),
    };

    setFrames([...frames, newFrame]);
    setActiveFrameId(newFrame.id); // Auto-switch to new frame
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
    setFrames(
      frames.map((frame) =>
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

    const newFrames = frames.filter((f) => f.id !== frameId);
    setFrames(newFrames);

    // Safety: If deleted active frame, switch to first frame (with bounds check)
    if (frameId === activeFrameId && newFrames.length > 0) {
      setActiveFrameId(newFrames[0].id);
    }
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
          // Line support (if needed in future templates)
          return {
            ...baseProps,
            type: "line",
            startX: insertX + tplEl.offsetX,
            startY: insertY + tplEl.offsetY,
            endX: insertX + tplEl.offsetX + tplEl.width,
            endY: insertY + tplEl.offsetY,
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

  const moveGroup = (groupId: string, dx: number, dy: number) => {
    setElements(
      elements.map((el) =>
        el.groupId === groupId
          ? el.type === "arrow"
            ? ({
                ...el,
                x: el.x + dx,
                y: el.y + dy,
                startX: (el as ArrowElement).startX + dx,
                startY: (el as ArrowElement).startY + dy,
                endX: (el as ArrowElement).endX + dx,
                endY: (el as ArrowElement).endY + dy,
              } as ArrowElement)
            : { ...el, x: el.x + dx, y: el.y + dy }
          : el,
      ),
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
          } as ArrowElement | LineElement;
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
          } as ArrowElement | LineElement;
        }
        return { ...el, x: el.x + dx, y: el.y + dy };
      }),
    );
  };

  // Generate unique element group ID
  const generateElementGroupId = () =>
    `egrp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Create a new user element group from selected elements
  const createElementGroup = () => {
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

    recordSnapshot(); // Record for undo

    const groupId = generateElementGroupId();
    const elementIds = Array.from(selectedElementIds);

    // Update elements with group reference
    setElements(
      elements.map((el) =>
        selectedElementIds.has(el.id) ? { ...el, elementGroupId: groupId } : el,
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
  };

  // Ungroup a user-created element group
  const ungroupElements = (elementGroupId: string) => {
    recordSnapshot(); // Record for undo
    // Remove group reference from all elements
    setElements(
      elements.map((el) =>
        el.elementGroupId === elementGroupId
          ? { ...el, elementGroupId: undefined }
          : el,
      ),
    );

    // Remove the group record
    setElementGroups(elementGroups.filter((grp) => grp.id !== elementGroupId));

    // Keep elements selected individually
    // selectedElementIds remains unchanged
  };

  // Delete all elements in a user-created element group
  const deleteElementGroup = (elementGroupId: string) => {
    recordSnapshot(); // Record for undo
    setElements(elements.filter((el) => el.elementGroupId !== elementGroupId));
    setElementGroups(elementGroups.filter((grp) => grp.id !== elementGroupId));

    // Clear selections
    setSelectedElementIds(new Set());
    setSelectedElementId(null);
  };

  const ungroupComponent = (groupId: string) => {
    recordSnapshot(); // Record for undo
    // Remove group reference from all elements
    setElements(
      elements.map((el) =>
        el.groupId === groupId
          ? { ...el, groupId: undefined, componentType: undefined }
          : el,
      ),
    );

    // Remove group
    setComponentGroups(componentGroups.filter((grp) => grp.id !== groupId));

    // Clear group selection
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
  };

  const deleteGroup = (groupId: string) => {
    recordSnapshot(); // Record for undo
    setElements(elements.filter((el) => el.groupId !== groupId));
    setComponentGroups(componentGroups.filter((grp) => grp.id !== groupId));

    // Clear selections
    setSelectedGroupId(null);
    setSelectedElementId(null);
  };

  // Text toolbar update handler
  const handleTextToolbarUpdate = (updates: Partial<TextElement>) => {
    if (!selectedElementId) return;
    setElements(
      elements.map((el) =>
        el.id === selectedElementId && el.type === "text"
          ? { ...el, ...updates }
          : el,
      ),
    );
  };

  // Get selected text element for toolbar (either selected or being edited)
  const textElementForToolbar = (() => {
    // First check if we're editing a text element
    if (editingElementId) {
      const editingElement = elements.find(
        (el) => el.id === editingElementId && el.type === "text"
      );
      if (editingElement) return editingElement as TextElement;
    }
    // Otherwise check if a text element is selected
    if (selectedElementId) {
      const selectedElement = elements.find(
        (el) => el.id === selectedElementId && el.type === "text"
      );
      if (selectedElement) return selectedElement as TextElement;
    }
    return undefined;
  })();

  // Component insertion handler
  const handleInsertComponent = (template: ComponentTemplate) => {
    // Insert at canvas center
    const insertX = 500;
    const insertY = 400;

    const group = createComponentGroup(template, insertX, insertY);

    // Select the newly created group
    setSelectedGroupId(group.id);

    // Switch to select tool
    setCurrentTool("select");
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 min-w-[900px]">
      <FrameList
        frames={frames}
        activeFrameId={activeFrameId}
        onSwitchFrame={handleSwitchFrame}
        onCreateFrame={handleCreateFrame}
        onRenameFrame={handleRenameFrame}
        onDeleteFrame={handleDeleteFrame}
        onRequestDeleteFrame={handleRequestDeleteFrame}
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
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                title="Zoom out (Ctrl+-)"
              >
                −
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded min-w-[50px] text-center"
                title="Reset zoom (Ctrl+0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                title="Zoom in (Ctrl++)"
              >
                +
              </button>
            </div>
            {/* Grid controls */}
            <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-2">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showGrid
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                title="Toggle grid (G)"
              >
                Grid
              </button>
              <button
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  snapToGrid
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                title="Toggle snap to grid (Shift+G)"
              >
                Snap
              </button>
            </div>
            <ThemeToggle />
            <ImageExport elements={elements} frameName={activeFrame?.name || 'wireflow'} />
            <ExportButton frames={frames} />
          </div>
        </div>

        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-hidden relative bg-white dark:bg-zinc-900"
        >
          <canvas
            ref={canvasRef}
            width={2000}
            height={2000}
            className={`absolute inset-0 ${currentTool === "select" ? "cursor-default" : "cursor-crosshair"} ${isPanning ? "cursor-grabbing" : ""}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setHoveredElementId(null);
              if (isPanning) {
                setIsPanning(false);
                setLastPanPoint(null);
              }
            }}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            role="img"
            aria-label={`Canvas for ${activeFrame?.name || "wireframing"}. Use the toolbar to select drawing tools.`}
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
              // Get typography properties with defaults
              const fontSize = textEl.fontSize || 16;
              const fontWeight = textEl.fontWeight || "normal";
              const fontStyle = textEl.fontStyle || "normal";
              const textAlign = textEl.textAlign || "left";
              const lineHeight =
                textEl.lineHeight || Math.round(fontSize * 1.5);

              // Calculate height based on line count (for auto-grow)
              const lineCount = Math.max(1, editingText.split("\n").length);
              const calculatedHeight = Math.max(
                lineHeight + TEXT_PADDING * 2,
                lineCount * lineHeight + TEXT_PADDING * 2,
              );

              // Calculate auto-width in real-time
              const currentWidth = textEl.autoWidth !== false
                ? Math.max(MIN_TEXT_WIDTH, calculateAutoWidth(editingText || " ", {
                    fontSize,
                    fontWeight,
                    fontStyle,
                  }))
                : editingElement.width;

              return (
                <textarea
                  ref={textInputRef}
                  value={editingText}
                  onChange={(e) => {
                    setEditingText(e.target.value);
                    // Update element width in real-time for auto-width
                    if (textEl.autoWidth !== false) {
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
                    // Shift+Enter for newline, Enter alone commits
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitTextEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      commitTextEdit(); // Escape now commits (Excalidraw behavior)
                    }
                    e.stopPropagation(); // Prevent canvas keyboard handlers
                  }}
                  onBlur={commitTextEdit}
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  data-gramm="false"
                  className="absolute resize-none overflow-hidden"
                  style={{
                    left: (editingElement.x + TEXT_PADDING) * zoom + pan.x,
                    top: editingElement.y * zoom + pan.y,
                    width: Math.max(currentWidth - TEXT_PADDING * 2, MIN_TEXT_WIDTH) * zoom,
                    minWidth: MIN_TEXT_WIDTH * zoom,
                    height: calculatedHeight * zoom,
                    fontFamily: "sans-serif",
                    fontSize: `${fontSize * zoom}px`,
                    fontWeight: fontWeight,
                    fontStyle: fontStyle,
                    textAlign: textAlign,
                    lineHeight: `${lineHeight * zoom}px`,
                    // Fully transparent - WYSIWYG
                    background: "transparent",
                    color: canvasTheme.sketch,
                    caretColor: canvasTheme.selected,
                    // Remove ALL styling
                    padding: 0,
                    margin: 0,
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    WebkitAppearance: "none",
                  }}
                  aria-label="Edit text element"
                />
              );
            })()}
          {/* Text formatting toolbar */}
          {textElementForToolbar && (
            <TextToolbar
              element={textElementForToolbar}
              canvasRect={canvasRect}
              onUpdate={handleTextToolbarUpdate}
            />
          )}
        </div>
      </div>

      <ComponentPanel onInsertComponent={handleInsertComponent} />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel="Delete"
        onConfirm={() => {
          confirmDialog.onConfirm();
          closeConfirmDialog();
        }}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}

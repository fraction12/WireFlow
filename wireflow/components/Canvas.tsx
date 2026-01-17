'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { CanvasElement, Tool, RectangleElement, TextElement, ArrowElement, Frame, FrameType, ComponentGroup, ComponentTemplate } from '@/lib/types';
import { Toolbar } from './Toolbar';
import { SidePanel } from './SidePanel';
import { ExportButton } from './ExportButton';
import { FrameList } from './FrameList';
import { ComponentPanel } from './ComponentPanel';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Constants for sketch rendering and interaction
  const SKETCH_AMPLITUDE = 1.5;
  const SEGMENT_DISTANCE = 20;
  const ARROW_HEAD_LENGTH = 15;
  const HANDLE_SIZE = 8;
  const HANDLE_TOLERANCE = 5;
  const MIN_ELEMENT_SIZE = 20;

  // Generate unique IDs (using substring instead of deprecated substr)
  const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const generateFrameId = () => `frame_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Initialize with default frame
  const defaultFrame: Frame = {
    id: generateFrameId(),
    name: 'Page 1',
    type: 'page',
    elements: [],
    createdAt: new Date().toISOString(),
  };

  // Frame state
  const [frames, setFrames] = useState<Frame[]>([defaultFrame]);
  const [activeFrameId, setActiveFrameId] = useState<string>(defaultFrame.id);

  // Computed: Get active frame and its elements
  const activeFrame = frames.find(f => f.id === activeFrameId);
  const elements = activeFrame?.elements || [];

  // Wrapper to update active frame's elements
  const setElements = (newElements: CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[])) => {
    const elementsArray = typeof newElements === 'function'
      ? newElements(elements)
      : newElements;

    setFrames(frames.map(frame =>
      frame.id === activeFrameId
        ? { ...frame, elements: elementsArray }
        : frame
    ));
  };

  // Tool and interaction state
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  // Component grouping state
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Helper function to get group elements (defined before redraw)
  const getGroupElements = useCallback((groupId: string): CanvasElement[] => {
    return elements.filter(el => el.groupId === groupId);
  }, [elements]);

  // Sketch-style rendering helpers
  const getRandomOffset = (base: number, seed: number, amplitude: number = SKETCH_AMPLITUDE): number => {
    // Use seed for deterministic randomness based on position
    const pseudo = Math.sin(seed * 12.9898 + base * 78.233) * 43758.5453;
    return (pseudo - Math.floor(pseudo)) * amplitude - amplitude / 2;
  };

  const drawSketchLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, seed: number = 0) => {
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

  const drawSketchRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, seed: number = 0) => {
    // Draw four sides with slight variations
    drawSketchLine(ctx, x, y, x + width, y, seed);           // Top
    drawSketchLine(ctx, x + width, y, x + width, y + height, seed + 1); // Right
    drawSketchLine(ctx, x + width, y + height, x, y + height, seed + 2); // Bottom
    drawSketchLine(ctx, x, y + height, x, y, seed + 3);      // Left
  };

  // Draw all elements on canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    elements.forEach((element) => {
      // Softer, low-contrast gray for sketch style
      ctx.strokeStyle = '#6b7280';
      ctx.fillStyle = '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.font = '16px sans-serif';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Highlight selected element with blue
      if (element.id === selectedElementId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#3b82f6';
      }

      // Highlight semantically tagged elements with green
      if (element.semanticTag) {
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
      }

      // Use element ID as seed for deterministic randomness
      const seed = parseInt(element.id.split('_')[1]) || 0;

      if (element.type === 'rectangle') {
        drawSketchRect(ctx, element.x, element.y, element.width, element.height, seed);
      } else if (element.type === 'text') {
        const textEl = element as TextElement;
        ctx.fillText(textEl.content || 'Text', element.x + 4, element.y + 16);
        // Draw sketch-style bounding box
        drawSketchRect(ctx, element.x, element.y, element.width, element.height, seed);
      } else if (element.type === 'arrow') {
        const arrowEl = element as ArrowElement;
        // Draw sketch-style arrow line
        drawSketchLine(ctx, arrowEl.startX, arrowEl.startY, arrowEl.endX, arrowEl.endY, seed);

        // Draw sketch-style arrowhead
        const angle = Math.atan2(arrowEl.endY - arrowEl.startY, arrowEl.endX - arrowEl.startX);

        const head1X = arrowEl.endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
        const head1Y = arrowEl.endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
        const head2X = arrowEl.endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
        const head2Y = arrowEl.endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

        drawSketchLine(ctx, arrowEl.endX, arrowEl.endY, head1X, head1Y, seed + 10);
        drawSketchLine(ctx, arrowEl.endX, arrowEl.endY, head2X, head2Y, seed + 11);
      }

      // Draw resize handles for selected element (only if not grouped)
      if (element.id === selectedElementId && element.type !== 'arrow' && !element.groupId) {
        ctx.fillStyle = '#3b82f6';
        ctx.strokeStyle = '#3b82f6';

        // Corner handles for resizing
        const handles = [
          { x: element.x - HANDLE_SIZE / 2, y: element.y - HANDLE_SIZE / 2 }, // NW
          { x: element.x + element.width - HANDLE_SIZE / 2, y: element.y - HANDLE_SIZE / 2 }, // NE
          { x: element.x - HANDLE_SIZE / 2, y: element.y + element.height - HANDLE_SIZE / 2 }, // SW
          { x: element.x + element.width - HANDLE_SIZE / 2, y: element.y + element.height - HANDLE_SIZE / 2 }, // SE
        ];

        handles.forEach((handle) => {
          ctx.beginPath();
          ctx.arc(handle.x + HANDLE_SIZE / 2, handle.y + HANDLE_SIZE / 2, HANDLE_SIZE / 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // Draw group selection outlines
    componentGroups.forEach(group => {
      if (group.id === selectedGroupId) {
        const groupElements = getGroupElements(group.id);
        if (groupElements.length === 0) return;

        // Calculate bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        groupElements.forEach(el => {
          minX = Math.min(minX, el.x);
          minY = Math.min(minY, el.y);
          maxX = Math.max(maxX, el.x + el.width);
          maxY = Math.max(maxY, el.y + el.height);
        });

        // Draw group selection box with sketch style
        ctx.strokeStyle = '#8b5cf6';  // Purple for groups
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]); // Dashed for group outline
        const groupSeed = parseInt(group.id.split('_')[1]) || 0;
        drawSketchRect(ctx, minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10, groupSeed);
        ctx.setLineDash([]);

        // Draw group label
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '12px sans-serif';
        const label = `Component: ${group.componentType}`;
        ctx.fillText(label, minX, minY - 10);
      }
    });
  }, [elements, selectedElementId, componentGroups, selectedGroupId, getGroupElements]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Find element at point
  const findElementAtPoint = (x: number, y: number): { element: CanvasElement | null; groupId?: string } => {
    // Search in reverse order (top element first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      let isHit = false;

      if (el.type === 'arrow') {
        const arrowEl = el as ArrowElement;
        // Simple distance check for arrow
        const dist = pointToLineDistance(x, y, arrowEl.startX, arrowEl.startY, arrowEl.endX, arrowEl.endY);
        isHit = dist < 10;
      } else {
        isHit = x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
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
  const pointToLineDistance = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
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

  // Check if point is on resize handle
  // Check if click is on a resize handle
  const getResizeHandle = (x: number, y: number, element: CanvasElement): string | null => {
    if (element.type === 'arrow') return null;

    const handles = {
      'nw': { x: element.x, y: element.y },
      'ne': { x: element.x + element.width, y: element.y },
      'sw': { x: element.x, y: element.y + element.height },
      'se': { x: element.x + element.width, y: element.y + element.height },
    };

    for (const [key, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= HANDLE_SIZE + HANDLE_TOLERANCE && Math.abs(y - pos.y) <= HANDLE_SIZE + HANDLE_TOLERANCE) {
        return key;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'select') {
      const { element: clickedElement, groupId } = findElementAtPoint(x, y);

      if (clickedElement) {
        setSelectedElementId(clickedElement.id);

        // If element is part of group, select the group
        if (groupId) {
          setSelectedGroupId(groupId);
        } else {
          setSelectedGroupId(null);
        }

        const handle = getResizeHandle(x, y, clickedElement);

        if (handle) {
          setResizeHandle(handle);
          setIsDrawing(true);
        } else {
          // Start dragging
          setDragOffset({ x: x - clickedElement.x, y: y - clickedElement.y });
          setIsDrawing(true);
        }
      } else {
        setSelectedElementId(null);
        setSelectedGroupId(null);
      }
    } else {
      setIsDrawing(true);
      setStartPoint({ x, y });

      // Immediate creation tools (click-to-place)
      if (currentTool === 'text') {
        const newElement: TextElement = {
          id: generateId(),
          type: 'text',
          x,
          y,
          width: 100,
          height: 20,
          content: 'Text',
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setIsDrawing(false);
        setStartPoint(null);
      } else if (currentTool === 'button') {
        // Button: grouped rectangle + centered text with semantic tag
        const groupId = generateGroupId();
        const buttonWidth = 120;
        const buttonHeight = 40;

        const buttonRect: RectangleElement = {
          id: generateId(),
          type: 'rectangle',
          x,
          y,
          width: buttonWidth,
          height: buttonHeight,
          semanticTag: 'button',
          groupId,
        };

        const buttonText: TextElement = {
          id: generateId(),
          type: 'text',
          x: x + 10,
          y: y + 10,
          width: buttonWidth - 20,
          height: 20,
          content: 'Button',
          groupId,
        };

        setElements([...elements, buttonRect, buttonText]);
        const group: ComponentGroup = {
          id: groupId,
          componentType: 'simple-form', // Reuse existing type for UI elements
          x,
          y,
          elementIds: [buttonRect.id, buttonText.id],
          createdAt: new Date().toISOString(),
        };
        setComponentGroups([...componentGroups, group]);
        setSelectedGroupId(groupId);
        setIsDrawing(false);
        setStartPoint(null);
      } else if (currentTool === 'input') {
        // Input field: rectangle + placeholder text
        const groupId = generateGroupId();
        const inputWidth = 200;
        const inputHeight = 36;

        const inputRect: RectangleElement = {
          id: generateId(),
          type: 'rectangle',
          x,
          y,
          width: inputWidth,
          height: inputHeight,
          semanticTag: 'input',
          groupId,
        };

        const placeholderText: TextElement = {
          id: generateId(),
          type: 'text',
          x: x + 8,
          y: y + 8,
          width: inputWidth - 16,
          height: 20,
          content: 'Placeholder text...',
          groupId,
        };

        setElements([...elements, inputRect, placeholderText]);
        const group: ComponentGroup = {
          id: groupId,
          componentType: 'simple-form',
          x,
          y,
          elementIds: [inputRect.id, placeholderText.id],
          createdAt: new Date().toISOString(),
        };
        setComponentGroups([...componentGroups, group]);
        setSelectedGroupId(groupId);
        setIsDrawing(false);
        setStartPoint(null);
      } else if (currentTool === 'checkbox') {
        // Checkbox: small square + label text
        const groupId = generateGroupId();
        const checkboxSize = 20;

        const checkboxRect: RectangleElement = {
          id: generateId(),
          type: 'rectangle',
          x,
          y,
          width: checkboxSize,
          height: checkboxSize,
          semanticTag: 'input',
          groupId,
        };

        const checkboxLabel: TextElement = {
          id: generateId(),
          type: 'text',
          x: x + checkboxSize + 8,
          y: y,
          width: 100,
          height: 20,
          content: 'Checkbox label',
          groupId,
        };

        setElements([...elements, checkboxRect, checkboxLabel]);
        const group: ComponentGroup = {
          id: groupId,
          componentType: 'simple-form',
          x,
          y,
          elementIds: [checkboxRect.id, checkboxLabel.id],
          createdAt: new Date().toISOString(),
        };
        setComponentGroups([...componentGroups, group]);
        setSelectedGroupId(groupId);
        setIsDrawing(false);
        setStartPoint(null);
      } else if (currentTool === 'divider') {
        // Divider: horizontal line (thin rectangle)
        const newElement: RectangleElement = {
          id: generateId(),
          type: 'rectangle',
          x,
          y,
          width: 300,
          height: 1,
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
        setIsDrawing(false);
        setStartPoint(null);
      } else if (currentTool === 'callout') {
        // Callout: text box + arrow pointer
        const groupId = generateGroupId();
        const noteWidth = 150;
        const noteHeight = 60;

        const noteRect: RectangleElement = {
          id: generateId(),
          type: 'rectangle',
          x,
          y,
          width: noteWidth,
          height: noteHeight,
          groupId,
        };

        const noteText: TextElement = {
          id: generateId(),
          type: 'text',
          x: x + 8,
          y: y + 8,
          width: noteWidth - 16,
          height: 20,
          content: 'Note text',
          groupId,
        };

        // Pointer arrow pointing down-left
        const pointer: ArrowElement = {
          id: generateId(),
          type: 'arrow',
          x: x,
          y: y + noteHeight,
          width: 40,
          height: 40,
          startX: x + noteWidth / 2,
          startY: y + noteHeight,
          endX: x + noteWidth / 2 + 40,
          endY: y + noteHeight + 40,
          groupId,
        };

        setElements([...elements, noteRect, noteText, pointer]);
        const group: ComponentGroup = {
          id: groupId,
          componentType: 'simple-form',
          x,
          y,
          elementIds: [noteRect.id, noteText.id, pointer.id],
          createdAt: new Date().toISOString(),
        };
        setComponentGroups([...componentGroups, group]);
        setSelectedGroupId(groupId);
        setIsDrawing(false);
        setStartPoint(null);
      } else if (currentTool === 'badge') {
        // State badge: small rounded rectangle + state text
        const groupId = generateGroupId();
        const badgeWidth = 80;
        const badgeHeight = 24;

        const badgeRect: RectangleElement = {
          id: generateId(),
          type: 'rectangle',
          x,
          y,
          width: badgeWidth,
          height: badgeHeight,
          groupId,
        };

        const badgeText: TextElement = {
          id: generateId(),
          type: 'text',
          x: x + 8,
          y: y + 2,
          width: badgeWidth - 16,
          height: 20,
          content: 'Empty',
          groupId,
        };

        setElements([...elements, badgeRect, badgeText]);
        const group: ComponentGroup = {
          id: groupId,
          componentType: 'empty-state',
          x,
          y,
          elementIds: [badgeRect.id, badgeText.id],
          createdAt: new Date().toISOString(),
        };
        setComponentGroups([...componentGroups, group]);
        setSelectedGroupId(groupId);
        setIsDrawing(false);
        setStartPoint(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'select' && selectedElementId) {
      const element = elements.find(el => el.id === selectedElementId);
      if (!element) return;

      if (resizeHandle) {
        // Resize (only for non-grouped elements)
        if (!selectedGroupId) {
          setElements(elements.map(el => {
            if (el.id === selectedElementId && el.type !== 'arrow') {
              const newEl = { ...el };
              switch (resizeHandle) {
                case 'se':
                  newEl.width = Math.max(MIN_ELEMENT_SIZE, x - el.x);
                  newEl.height = Math.max(MIN_ELEMENT_SIZE, y - el.y);
                  break;
                case 'sw':
                  newEl.width = Math.max(MIN_ELEMENT_SIZE, el.x + el.width - x);
                  newEl.height = Math.max(MIN_ELEMENT_SIZE, y - el.y);
                  newEl.x = x;
                  break;
                case 'ne':
                  newEl.width = Math.max(MIN_ELEMENT_SIZE, x - el.x);
                  newEl.height = Math.max(MIN_ELEMENT_SIZE, el.y + el.height - y);
                  newEl.y = y;
                  break;
                case 'nw':
                  newEl.width = Math.max(MIN_ELEMENT_SIZE, el.x + el.width - x);
                  newEl.height = Math.max(MIN_ELEMENT_SIZE, el.y + el.height - y);
                  newEl.x = x;
                  newEl.y = y;
                  break;
              }
              return newEl;
            }
            return el;
          }));
        }
      } else if (dragOffset) {
        // Move - either group or individual element
        if (selectedGroupId) {
          // Move entire group
          const dx = x - dragOffset.x - element.x;
          const dy = y - dragOffset.y - element.y;
          moveGroup(selectedGroupId, dx, dy);
        } else {
          // Move single element
          setElements(elements.map(el => {
            if (el.id === selectedElementId) {
              if (el.type === 'arrow') {
                const arrowEl = el as ArrowElement;
                const dx = x - dragOffset.x - el.x;
                const dy = y - dragOffset.y - el.y;
                return {
                  ...arrowEl,
                  x: x - dragOffset.x,
                  y: y - dragOffset.y,
                  startX: arrowEl.startX + dx,
                  startY: arrowEl.startY + dy,
                  endX: arrowEl.endX + dx,
                  endY: arrowEl.endY + dy,
                };
              }
              return { ...el, x: x - dragOffset.x, y: y - dragOffset.y };
            }
            return el;
          }));
        }
      }
    } else if (startPoint && (currentTool === 'rectangle' || currentTool === 'arrow')) {
      // Preview while drawing
      redraw();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([8, 4]);

      if (currentTool === 'rectangle') {
        const width = x - startPoint.x;
        const height = y - startPoint.y;
        // Use simple sketch rect for preview
        const previewSeed = Date.now() % 1000;
        drawSketchRect(ctx, startPoint.x, startPoint.y, width, height, previewSeed);
      } else if (currentTool === 'arrow') {
        const previewSeed = Date.now() % 1000;
        drawSketchLine(ctx, startPoint.x, startPoint.y, x, y, previewSeed);
      }

      ctx.setLineDash([]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (startPoint && currentTool !== 'select') {
      if (currentTool === 'rectangle') {
        const width = x - startPoint.x;
        const height = y - startPoint.y;

        if (Math.abs(width) > 5 && Math.abs(height) > 5) {
          const newElement: RectangleElement = {
            id: generateId(),
            type: 'rectangle',
            x: width > 0 ? startPoint.x : x,
            y: height > 0 ? startPoint.y : y,
            width: Math.abs(width),
            height: Math.abs(height),
          };
          setElements([...elements, newElement]);
        }
      } else if (currentTool === 'arrow') {
        const newElement: ArrowElement = {
          id: generateId(),
          type: 'arrow',
          x: Math.min(startPoint.x, x),
          y: Math.min(startPoint.y, y),
          width: Math.abs(x - startPoint.x),
          height: Math.abs(y - startPoint.y),
          startX: startPoint.x,
          startY: startPoint.y,
          endX: x,
          endY: y,
        };
        setElements([...elements, newElement]);
      }
    }

    setIsDrawing(false);
    setStartPoint(null);
    setDragOffset(null);
    setResizeHandle(null);
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // Keyboard event handler for deletion and ungrouping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if an element is selected
      if (!selectedElementId) return;

      const element = elements.find(el => el.id === selectedElementId);
      if (!element) return;

      // Check for Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent default browser behavior (e.g., navigate back)
        e.preventDefault();

        // If element is grouped, delete entire group with confirmation
        if (element.groupId) {
          const componentName = element.componentType || 'grouped';
          const shouldDelete = window.confirm(`Delete entire ${componentName} component?`);
          if (shouldDelete) {
            deleteGroup(element.groupId);
          }
        } else {
          // Remove single element from state
          setElements(elements.filter(el => el.id !== selectedElementId));
          setSelectedElementId(null);
        }
      }

      // Check for 'G' key to ungroup
      if (e.key === 'g' || e.key === 'G') {
        if (element.groupId) {
          e.preventDefault();
          ungroupComponent(element.groupId);
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElementId, elements, componentGroups]);

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
    setActiveFrameId(newFrame.id);  // Auto-switch to new frame
  };

  const handleSwitchFrame = (frameId: string) => {
    // Current frame state is already persisted in frames array
    setActiveFrameId(frameId);
    setSelectedElementId(null);  // Clear selection when switching
  };

  const handleRenameFrame = (frameId: string, newName: string) => {
    setFrames(frames.map(frame =>
      frame.id === frameId
        ? { ...frame, name: newName }
        : frame
    ));
  };

  const handleDeleteFrame = (frameId: string) => {
    // Safety: Prevent deleting the last frame
    if (frames.length === 1) {
      alert('Cannot delete the last frame');
      return;
    }

    const newFrames = frames.filter(f => f.id !== frameId);
    setFrames(newFrames);

    // Safety: If deleted active frame, switch to first frame (with bounds check)
    if (frameId === activeFrameId && newFrames.length > 0) {
      setActiveFrameId(newFrames[0].id);
    }
  };

  // Component group operations
  const generateGroupId = () => `grp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const createComponentGroup = (template: ComponentTemplate, insertX: number, insertY: number): ComponentGroup => {
    const groupId = generateGroupId();
    const elementIds: string[] = [];

    // Create all elements with group reference
    const newElements: CanvasElement[] = template.elements.map(tplEl => {
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

      if (tplEl.type === 'text') {
        return {
          ...baseProps,
          type: 'text',
          content: tplEl.content || 'Text',
        } as TextElement;
      } else if (tplEl.type === 'rectangle') {
        return {
          ...baseProps,
          type: 'rectangle',
        } as RectangleElement;
      } else if (tplEl.type === 'arrow') {
        // Arrow support (if needed in future templates)
        return {
          ...baseProps,
          type: 'arrow',
          startX: insertX + tplEl.offsetX,
          startY: insertY + tplEl.offsetY,
          endX: insertX + tplEl.offsetX + tplEl.width,
          endY: insertY + tplEl.offsetY + tplEl.height,
        } as ArrowElement;
      }
      return null;
    }).filter((el): el is CanvasElement => el !== null);

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
    setElements(elements.map(el =>
      el.groupId === groupId
        ? el.type === 'arrow'
          ? {
              ...el,
              x: el.x + dx,
              y: el.y + dy,
              startX: (el as ArrowElement).startX + dx,
              startY: (el as ArrowElement).startY + dy,
              endX: (el as ArrowElement).endX + dx,
              endY: (el as ArrowElement).endY + dy,
            } as ArrowElement
          : { ...el, x: el.x + dx, y: el.y + dy }
        : el
    ));

    setComponentGroups(componentGroups.map(grp =>
      grp.id === groupId
        ? { ...grp, x: grp.x + dx, y: grp.y + dy }
        : grp
    ));
  };

  const ungroupComponent = (groupId: string) => {
    // Remove group reference from all elements
    setElements(elements.map(el =>
      el.groupId === groupId
        ? { ...el, groupId: undefined, componentType: undefined }
        : el
    ));

    // Remove group
    setComponentGroups(componentGroups.filter(grp => grp.id !== groupId));

    // Clear group selection
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }
  };

  const deleteGroup = (groupId: string) => {
    setElements(elements.filter(el => el.groupId !== groupId));
    setComponentGroups(componentGroups.filter(grp => grp.id !== groupId));

    // Clear selections
    setSelectedGroupId(null);
    setSelectedElementId(null);
  };

  // Component insertion handler
  const handleInsertComponent = (template: ComponentTemplate) => {
    // Insert at canvas center
    const insertX = 500;
    const insertY = 400;

    const group = createComponentGroup(template, insertX, insertY);

    // Select the newly created group
    setSelectedGroupId(group.id);

    // Switch to select tool
    setCurrentTool('select');
  };

  return (
    <div className="flex h-screen bg-zinc-50">
      <FrameList
        frames={frames}
        activeFrameId={activeFrameId}
        onSwitchFrame={handleSwitchFrame}
        onCreateFrame={handleCreateFrame}
        onRenameFrame={handleRenameFrame}
        onDeleteFrame={handleDeleteFrame}
      />

      <Toolbar currentTool={currentTool} onToolChange={setCurrentTool} />

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-zinc-200 px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-zinc-900">
            {activeFrame?.name || 'WireFlow'}
          </h1>
          <ExportButton frames={frames} />
        </div>

        <div className="flex-1 overflow-hidden relative">
          <canvas
            ref={canvasRef}
            width={2000}
            height={2000}
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>
      </div>

      <ComponentPanel onInsertComponent={handleInsertComponent} />

      {selectedElement && (
        <SidePanel
          element={selectedElement}
          onUpdateElement={(updatedElement) => {
            setElements(elements.map(el =>
              el.id === updatedElement.id ? updatedElement : el
            ));
          }}
          onClose={() => {
            setSelectedElementId(null);
            setSelectedGroupId(null);
          }}
          onDelete={() => {
            // Delete entire group if element is grouped, otherwise just delete element
            if (selectedElement.groupId) {
              const shouldDelete = window.confirm(`Delete entire ${selectedElement.componentType} component?`);
              if (shouldDelete) {
                deleteGroup(selectedElement.groupId);
              }
            } else {
              setElements(elements.filter(el => el.id !== selectedElementId));
              setSelectedElementId(null);
            }
          }}
          onUngroupComponent={ungroupComponent}
          groupElementCount={selectedElement.groupId ? getGroupElements(selectedElement.groupId).length : undefined}
        />
      )}
    </div>
  );
}

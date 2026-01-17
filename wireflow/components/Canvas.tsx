'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { CanvasElement, Tool, RectangleElement, TextElement, ArrowElement } from '@/lib/types';
import { Toolbar } from './Toolbar';
import { SidePanel } from './SidePanel';
import { ExportButton } from './ExportButton';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [currentTool, setCurrentTool] = useState<Tool>('select');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  // Generate unique ID
  const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      ctx.strokeStyle = '#374151';
      ctx.fillStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.font = '16px sans-serif';

      // Highlight selected element
      if (element.id === selectedElementId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#3b82f6';
      }

      // Highlight semantically tagged elements
      if (element.semanticTag) {
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
      }

      if (element.type === 'rectangle') {
        ctx.strokeRect(element.x, element.y, element.width, element.height);
      } else if (element.type === 'text') {
        const textEl = element as TextElement;
        ctx.fillText(textEl.content || 'Text', element.x, element.y + 16);
        // Draw bounding box for selection
        if (element.id === selectedElementId) {
          ctx.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);
        }
      } else if (element.type === 'arrow') {
        const arrowEl = element as ArrowElement;
        ctx.beginPath();
        ctx.moveTo(arrowEl.startX, arrowEl.startY);
        ctx.lineTo(arrowEl.endX, arrowEl.endY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(arrowEl.endY - arrowEl.startY, arrowEl.endX - arrowEl.startX);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(arrowEl.endX, arrowEl.endY);
        ctx.lineTo(
          arrowEl.endX - headLength * Math.cos(angle - Math.PI / 6),
          arrowEl.endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(arrowEl.endX, arrowEl.endY);
        ctx.lineTo(
          arrowEl.endX - headLength * Math.cos(angle + Math.PI / 6),
          arrowEl.endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }

      // Draw resize handles for selected element
      if (element.id === selectedElementId && element.type !== 'arrow') {
        const handleSize = 8;
        ctx.fillStyle = '#3b82f6';
        // Corner handles
        ctx.fillRect(element.x - handleSize / 2, element.y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(element.x + element.width - handleSize / 2, element.y - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(element.x - handleSize / 2, element.y + element.height - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(element.x + element.width - handleSize / 2, element.y + element.height - handleSize / 2, handleSize, handleSize);
      }
    });
  }, [elements, selectedElementId]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Find element at point
  const findElementAtPoint = (x: number, y: number): CanvasElement | null => {
    // Search in reverse order (top element first)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.type === 'arrow') {
        const arrowEl = el as ArrowElement;
        // Simple distance check for arrow
        const dist = pointToLineDistance(x, y, arrowEl.startX, arrowEl.startY, arrowEl.endX, arrowEl.endY);
        if (dist < 10) return el;
      } else {
        if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
          return el;
        }
      }
    }
    return null;
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
  const getResizeHandle = (x: number, y: number, element: CanvasElement): string | null => {
    if (element.type === 'arrow') return null;
    const handleSize = 8;
    const tolerance = 5;

    const handles = {
      'nw': { x: element.x, y: element.y },
      'ne': { x: element.x + element.width, y: element.y },
      'sw': { x: element.x, y: element.y + element.height },
      'se': { x: element.x + element.width, y: element.y + element.height },
    };

    for (const [key, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= handleSize + tolerance && Math.abs(y - pos.y) <= handleSize + tolerance) {
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
      const clickedElement = findElementAtPoint(x, y);

      if (clickedElement) {
        setSelectedElementId(clickedElement.id);
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
      }
    } else {
      setIsDrawing(true);
      setStartPoint({ x, y });

      if (currentTool === 'text') {
        // For text, create element immediately
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
        // Resize
        setElements(elements.map(el => {
          if (el.id === selectedElementId && el.type !== 'arrow') {
            const newEl = { ...el };
            switch (resizeHandle) {
              case 'se':
                newEl.width = Math.max(20, x - el.x);
                newEl.height = Math.max(20, y - el.y);
                break;
              case 'sw':
                newEl.width = Math.max(20, el.x + el.width - x);
                newEl.height = Math.max(20, y - el.y);
                newEl.x = x;
                break;
              case 'ne':
                newEl.width = Math.max(20, x - el.x);
                newEl.height = Math.max(20, el.y + el.height - y);
                newEl.y = y;
                break;
              case 'nw':
                newEl.width = Math.max(20, el.x + el.width - x);
                newEl.height = Math.max(20, el.y + el.height - y);
                newEl.x = x;
                newEl.y = y;
                break;
            }
            return newEl;
          }
          return el;
        }));
      } else if (dragOffset) {
        // Move
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
    } else if (startPoint && (currentTool === 'rectangle' || currentTool === 'arrow')) {
      // Preview while drawing
      redraw();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx) return;

      ctx.strokeStyle = '#9ca3af';
      ctx.setLineDash([5, 5]);

      if (currentTool === 'rectangle') {
        const width = x - startPoint.x;
        const height = y - startPoint.y;
        ctx.strokeRect(startPoint.x, startPoint.y, width, height);
      } else if (currentTool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
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

  // Keyboard event handler for deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle deletion if an element is selected
      if (!selectedElementId) return;

      // Check for Delete or Backspace key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent default browser behavior (e.g., navigate back)
        e.preventDefault();

        // Remove element from state
        setElements(elements.filter(el => el.id !== selectedElementId));

        // Clear selection
        setSelectedElementId(null);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElementId, elements]);

  return (
    <div className="flex h-screen bg-zinc-50">
      <Toolbar currentTool={currentTool} onToolChange={setCurrentTool} />

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-zinc-200 px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-zinc-900">WireFlow</h1>
          <ExportButton elements={elements} />
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

      {selectedElement && (
        <SidePanel
          element={selectedElement}
          onUpdateElement={(updatedElement) => {
            setElements(elements.map(el =>
              el.id === updatedElement.id ? updatedElement : el
            ));
          }}
          onClose={() => setSelectedElementId(null)}
          onDelete={() => {
            // Remove element and clear selection
            setElements(elements.filter(el => el.id !== selectedElementId));
            setSelectedElementId(null);
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Image, FileCode, ChevronDown } from 'lucide-react';
import type {
  CanvasElement,
  TextElement,
  ArrowElement,
  LineElement,
  FreedrawElement,
  UserComponent,
  ComponentInstance,
  ComponentElementDef,
} from '@/lib/types';
import { useToast } from '../ui/Toast';
import {
  wrapText,
  drawSketchLine,
  drawSketchRect,
  drawSketchEllipse,
  drawSketchDiamond,
  drawFreedraw,
} from '../canvas-core/renderers';
import { ARROW_HEAD_LENGTH } from '../canvas-core/constants';
import { DEFAULT_STROKE_COLOR, EXPORT_BG_COLOR } from '@/lib/colors';
import { TEXT_PADDING } from '@/lib/textMeasurement';

// Maximum canvas dimension supported by browsers
// Most browsers support up to 32767 pixels per dimension
const MAX_CANVAS_DIMENSION = 32767;

interface ImageExportProps {
  elements: CanvasElement[];
  frameName: string;
  /** User-defined components for rendering instances */
  userComponents?: UserComponent[];
  /** Component instances placed on the canvas */
  componentInstances?: ComponentInstance[];
  /** Active frame ID for filtering instances */
  activeFrameId?: string;
}

// Maximum preview thumbnail size
const PREVIEW_MAX_WIDTH = 200;
const PREVIEW_MAX_HEIGHT = 150;

export function ImageExport({
  elements,
  frameName,
  userComponents = [],
  componentInstances = [],
  activeFrameId,
}: ImageExportProps) {
  // Filter out hidden elements for export
  const visibleElements = elements.filter(el => el.visible !== false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { addToast } = useToast();

  // Menu options for keyboard navigation
  const menuOptions = [
    { label: 'Export as PNG', action: () => exportPNG() },
    { label: 'Export as SVG', action: () => exportSVG() },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reset focus index when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
    } else {
      // Focus first item when dropdown opens
      setFocusedIndex(0);
    }
  }, [isOpen]);

  // Focus the menu item when focusedIndex changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuItemRefs.current[focusedIndex]) {
      menuItemRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  // Handle keyboard navigation in dropdown
  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % menuOptions.length);
        break;

      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + menuOptions.length) % menuOptions.length);
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(menuOptions.length - 1);
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) {
          menuOptions[focusedIndex].action();
        }
        break;

      case 'Tab':
        // Close dropdown on Tab to maintain expected behavior
        setIsOpen(false);
        break;
    }
  };

  // Get component instances for the active frame
  const frameInstances = activeFrameId
    ? componentInstances.filter(i => i.frameId === activeFrameId)
    : componentInstances;

  // Calculate bounding box for all elements (including component instances)
  const getBoundingBox = useCallback(() => {
    const hasVisibleElements = visibleElements.length > 0;
    const hasInstances = frameInstances.length > 0;

    if (!hasVisibleElements && !hasInstances) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    // Include visible elements in bounds
    visibleElements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    // Include component instances in bounds
    frameInstances.forEach((instance) => {
      const component = userComponents.find(c => c.id === instance.componentId);
      if (!component) return;

      minX = Math.min(minX, instance.x);
      minY = Math.min(minY, instance.y);
      maxX = Math.max(maxX, instance.x + component.width);
      maxY = Math.max(maxY, instance.y + component.height);
    });

    // Add padding
    const padding = 40;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [visibleElements, frameInstances, userComponents]);

  // Helper function to render a single element (used by both elements and component instances)
  const renderElement = (
    ctx: CanvasRenderingContext2D,
    element: CanvasElement | ComponentElementDef,
    x: number,
    y: number,
    seed: number,
    defaultSketchColor: string,
    // For bound text vertical centering
    allElements?: CanvasElement[],
    offsetX?: number,
    offsetY?: number
  ) => {
    // Read element-specific colors or fall back to defaults
    const elementStrokeColor = element.style?.strokeColor || defaultSketchColor;
    const elementFillColor = element.style?.fillColor || 'transparent';
    ctx.strokeStyle = elementStrokeColor;
    ctx.fillStyle = elementStrokeColor;

    // Apply rotation for rotatable elements
    const rotation = element.rotation || 0;
    const hasRotation = rotation !== 0 && element.type !== 'arrow' && element.type !== 'line' && element.type !== 'freedraw' && element.type !== 'text';

    if (hasRotation) {
      const centerX = x + element.width / 2;
      const centerY = y + element.height / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
    }

    if (element.type === 'rectangle') {
      // Fill rectangle first if fill color is set
      if (elementFillColor && elementFillColor !== 'transparent') {
        ctx.fillStyle = elementFillColor;
        ctx.fillRect(x, y, element.width, element.height);
      }
      // Then draw the stroke
      ctx.strokeStyle = elementStrokeColor;
      drawSketchRect(ctx, x, y, element.width, element.height, seed);
    } else if (element.type === 'ellipse') {
      // Fill ellipse first if fill color is set
      if (elementFillColor && elementFillColor !== 'transparent') {
        ctx.fillStyle = elementFillColor;
        ctx.beginPath();
        ctx.ellipse(
          x + element.width / 2,
          y + element.height / 2,
          element.width / 2,
          element.height / 2,
          0, 0, Math.PI * 2
        );
        ctx.fill();
      }
      // Then draw the stroke
      ctx.strokeStyle = elementStrokeColor;
      drawSketchEllipse(ctx, x, y, element.width, element.height, seed);
    } else if (element.type === 'diamond') {
      // Fill diamond first if fill color is set
      if (elementFillColor && elementFillColor !== 'transparent') {
        ctx.fillStyle = elementFillColor;
        const cx = x + element.width / 2;
        const cy = y + element.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx, y); // Top
        ctx.lineTo(x + element.width, cy); // Right
        ctx.lineTo(cx, y + element.height); // Bottom
        ctx.lineTo(x, cy); // Left
        ctx.closePath();
        ctx.fill();
      }
      // Then draw the stroke
      ctx.strokeStyle = elementStrokeColor;
      drawSketchDiamond(ctx, x, y, element.width, element.height, seed);
    }

    if (hasRotation) {
      ctx.restore();
    }

    if (element.type === 'text') {
      const textEl = element as TextElement;
      const fontSize = textEl.fontSize || 16;
      const fontWeight = textEl.fontWeight || 'normal';
      const fontStyle = textEl.fontStyle || 'normal';
      const textAlign = textEl.textAlign || 'left';
      const lineHeight = textEl.lineHeight || Math.round(fontSize * 1.5);
      const isBoundText = !!(textEl as TextElement).containerId;

      ctx.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'alphabetic';

      let textX: number;
      switch (textAlign) {
        case 'center':
          textX = x + element.width / 2;
          break;
        case 'right':
          textX = x + element.width - TEXT_PADDING;
          break;
        default:
          textX = x + TEXT_PADDING;
      }

      // Use element's stroke color for text fill (matches Canvas.tsx behavior)
      ctx.fillStyle = elementStrokeColor;

      // Wrap text to fit within element width
      const maxWidth = element.width - TEXT_PADDING * 2;
      const lines = wrapText(ctx, (textEl as TextElement).content || (element as ComponentElementDef).content || '', maxWidth);

      // Calculate Y position - handle bound text vertical centering
      let textY = y + fontSize;
      if (isBoundText && (textEl as TextElement).verticalAlign === 'middle' && allElements && offsetX !== undefined && offsetY !== undefined) {
        // Find the container element for vertical centering
        const container = allElements.find(el => el.id === (textEl as TextElement).containerId);
        if (container) {
          const totalTextHeight = lines.length * lineHeight;
          const containerY = container.y - offsetY;
          textY = containerY + (container.height - totalTextHeight) / 2 + fontSize;
        }
      }

      // Render each line of wrapped text
      lines.forEach((line, index) => {
        ctx.fillText(line, textX, textY + index * lineHeight);
      });
    } else if (element.type === 'arrow') {
      const arrowEl = element as ArrowElement;
      const startX = (arrowEl.startX ?? (element as ComponentElementDef).startX ?? 0) - (offsetX ?? 0);
      const startY = (arrowEl.startY ?? (element as ComponentElementDef).startY ?? 0) - (offsetY ?? 0);
      const endX = (arrowEl.endX ?? (element as ComponentElementDef).endX ?? 0) - (offsetX ?? 0);
      const endY = (arrowEl.endY ?? (element as ComponentElementDef).endY ?? 0) - (offsetY ?? 0);

      // For component instance elements, coordinates are already adjusted
      const finalStartX = 'containerId' in element ? startX : x + (startX - x);
      const finalStartY = 'containerId' in element ? startY : y + (startY - y);
      const finalEndX = 'containerId' in element ? endX : x + (endX - x);
      const finalEndY = 'containerId' in element ? endY : y + (endY - y);

      drawSketchLine(ctx, finalStartX, finalStartY, finalEndX, finalEndY, seed);

      // Draw arrowhead
      const angle = Math.atan2(finalEndY - finalStartY, finalEndX - finalStartX);
      const head1X = finalEndX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
      const head1Y = finalEndY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
      const head2X = finalEndX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
      const head2Y = finalEndY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

      drawSketchLine(ctx, finalEndX, finalEndY, head1X, head1Y, seed + 10);
      drawSketchLine(ctx, finalEndX, finalEndY, head2X, head2Y, seed + 11);
    } else if (element.type === 'line') {
      const lineEl = element as LineElement;
      const startX = (lineEl.startX ?? (element as ComponentElementDef).startX ?? 0) - (offsetX ?? 0);
      const startY = (lineEl.startY ?? (element as ComponentElementDef).startY ?? 0) - (offsetY ?? 0);
      const endX = (lineEl.endX ?? (element as ComponentElementDef).endX ?? 0) - (offsetX ?? 0);
      const endY = (lineEl.endY ?? (element as ComponentElementDef).endY ?? 0) - (offsetY ?? 0);

      // For component instance elements, coordinates are already adjusted
      const finalStartX = 'containerId' in element ? startX : x + (startX - x);
      const finalStartY = 'containerId' in element ? startY : y + (startY - y);
      const finalEndX = 'containerId' in element ? endX : x + (endX - x);
      const finalEndY = 'containerId' in element ? endY : y + (endY - y);

      drawSketchLine(ctx, finalStartX, finalStartY, finalEndX, finalEndY, seed);
    } else if (element.type === 'freedraw') {
      const freedrawEl = element as FreedrawElement;
      const points = freedrawEl.points || (element as ComponentElementDef).points || [];
      const adjustedPoints = points.map((p) => ({
        x: p.x - (offsetX ?? 0),
        y: p.y - (offsetY ?? 0),
      }));
      drawFreedraw(ctx, adjustedPoints);
    }
  };

  // Render elements to canvas
  const renderToCanvas = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) => {
    const defaultSketchColor = DEFAULT_STROKE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Render visible elements
    visibleElements.forEach((element) => {
      const seed = parseInt(element.id.split('_')[1] || '0', 10) % 1000;
      const x = element.x - offsetX;
      const y = element.y - offsetY;

      renderElement(ctx, element, x, y, seed, defaultSketchColor, visibleElements, offsetX, offsetY);
    });

    // Render component instances
    frameInstances.forEach((instance) => {
      const component = userComponents.find(c => c.id === instance.componentId);
      if (!component) return;

      // Draw each element from the master definition
      component.masterElements.forEach((def) => {
        const x = instance.x + def.offsetX - offsetX;
        const y = instance.y + def.offsetY - offsetY;
        const seed = parseInt(def.id.split('_')[1] || '0', 10) % 1000;

        // Handle text content override for component instances
        if (def.type === 'text') {
          const override = instance.overrides?.find(o => o.elementId === def.id && o.property === 'content');
          const content = override ? String(override.value) : (def.content || '');
          const textDef = { ...def, content } as ComponentElementDef;
          renderElement(ctx, textDef as unknown as CanvasElement, x, y, seed, defaultSketchColor);
        } else if (def.type === 'arrow' || def.type === 'line') {
          // For arrows and lines in component instances, calculate absolute positions
          const startX = instance.x + (def.startX || 0) - offsetX;
          const startY = instance.y + (def.startY || 0) - offsetY;
          const endX = instance.x + (def.endX || 0) - offsetX;
          const endY = instance.y + (def.endY || 0) - offsetY;

          ctx.strokeStyle = def.style?.strokeColor || defaultSketchColor;
          drawSketchLine(ctx, startX, startY, endX, endY, seed);

          if (def.type === 'arrow') {
            // Draw arrowhead
            const angle = Math.atan2(endY - startY, endX - startX);
            const head1X = endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
            const head1Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
            const head2X = endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
            const head2Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

            drawSketchLine(ctx, endX, endY, head1X, head1Y, seed + 10);
            drawSketchLine(ctx, endX, endY, head2X, head2Y, seed + 11);
          }
        } else if (def.type === 'freedraw' && def.points) {
          // For freedraw in component instances
          const translatedPoints = def.points.map(p => ({
            x: instance.x + p.x - offsetX,
            y: instance.y + p.y - offsetY,
          }));
          ctx.strokeStyle = def.style?.strokeColor || defaultSketchColor;
          drawFreedraw(ctx, translatedPoints);
        } else {
          renderElement(ctx, def as unknown as CanvasElement, x, y, seed, defaultSketchColor);
        }
      });
    });
  }, [visibleElements, frameInstances, userComponents]);

  // Check if there's anything to export (visible elements or instances)
  const hasExportableContent = visibleElements.length > 0 || frameInstances.length > 0;

  // Generate preview when dropdown opens
  useEffect(() => {
    if (!isOpen || !hasExportableContent) {
      setPreviewDataUrl(null);
      setPreviewDimensions(null);
      return;
    }

    // Generate preview asynchronously to avoid blocking UI
    const generatePreview = () => {
      try {
        const bounds = getBoundingBox();

        // Calculate thumbnail dimensions maintaining aspect ratio
        const aspectRatio = bounds.width / bounds.height;
        let previewWidth: number;
        let previewHeight: number;

        if (aspectRatio > PREVIEW_MAX_WIDTH / PREVIEW_MAX_HEIGHT) {
          // Wider than tall - constrain by width
          previewWidth = PREVIEW_MAX_WIDTH;
          previewHeight = PREVIEW_MAX_WIDTH / aspectRatio;
        } else {
          // Taller than wide - constrain by height
          previewHeight = PREVIEW_MAX_HEIGHT;
          previewWidth = PREVIEW_MAX_HEIGHT * aspectRatio;
        }

        const scale = previewWidth / bounds.width;

        const canvas = document.createElement('canvas');
        canvas.width = previewWidth;
        canvas.height = previewHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // White background
        ctx.fillStyle = EXPORT_BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale down for preview
        ctx.scale(scale, scale);

        // Render elements to preview canvas
        renderToCanvas(ctx, bounds.x, bounds.y);

        setPreviewDataUrl(canvas.toDataURL('image/png'));
        setPreviewDimensions({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
      } catch {
        // Silently fail - preview is not critical
        setPreviewDataUrl(null);
        setPreviewDimensions(null);
      }
    };

    // Use requestAnimationFrame for smooth rendering
    const rafId = requestAnimationFrame(generatePreview);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, hasExportableContent, getBoundingBox, renderToCanvas]);

  const exportPNG = () => {
    if (!hasExportableContent) {
      addToast({
        type: 'warning',
        title: 'Nothing to export',
        message: 'Add some elements to the canvas first.',
      });
      setIsOpen(false);
      return;
    }

    try {
      const bounds = getBoundingBox();
      const scale = 2; // 2x for retina
      const scaledWidth = bounds.width * scale;
      const scaledHeight = bounds.height * scale;

      // Validate canvas dimensions don't exceed browser limits
      if (scaledWidth > MAX_CANVAS_DIMENSION || scaledHeight > MAX_CANVAS_DIMENSION) {
        const maxUnscaledSize = Math.floor(MAX_CANVAS_DIMENSION / scale);
        addToast({
          type: 'error',
          title: 'Canvas too large',
          message: `Export dimensions exceed browser limits. Maximum size is ${maxUnscaledSize}x${maxUnscaledSize} pixels.`,
        });
        setIsOpen(false);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // White background
      ctx.fillStyle = EXPORT_BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale for retina
      ctx.scale(scale, scale);

      renderToCanvas(ctx, bounds.x, bounds.y);

      // Download
      const link = document.createElement('a');
      link.download = `${frameName}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      const totalItems = visibleElements.length + frameInstances.length;
      addToast({
        type: 'success',
        title: 'PNG exported',
        message: `Exported ${totalItems} item(s) as PNG`,
      });
    } catch (error) {
      console.error('PNG export failed:', error);
      addToast({
        type: 'error',
        title: 'Export failed',
        message: 'Failed to export PNG. Please try again.',
      });
    } finally {
      setIsOpen(false);
    }
  };

  // Helper function to generate SVG for an element
  const elementToSvg = (
    element: CanvasElement | ComponentElementDef,
    x: number,
    y: number,
    defaultSketchColor: string,
    content?: string // For text content override
  ): string => {
    const elementStrokeColor = element.style?.strokeColor || defaultSketchColor;
    const elementFillColor = element.style?.fillColor || 'transparent';
    const svgFillColor = elementFillColor === 'transparent' ? 'none' : elementFillColor;

    const rotation = element.rotation || 0;
    const rotationDegrees = (rotation * 180) / Math.PI;
    const hasRotation = rotation !== 0 && element.type !== 'arrow' && element.type !== 'line' && element.type !== 'freedraw' && element.type !== 'text';
    const centerX = x + element.width / 2;
    const centerY = y + element.height / 2;
    const rotateAttr = hasRotation ? ` transform="rotate(${rotationDegrees.toFixed(2)} ${centerX.toFixed(2)} ${centerY.toFixed(2)})"` : '';

    if (element.type === 'rectangle') {
      return `    <rect x="${x}" y="${y}" width="${element.width}" height="${element.height}" stroke="${elementStrokeColor}" fill="${svgFillColor}"${rotateAttr}/>\n`;
    } else if (element.type === 'ellipse') {
      const cx = x + element.width / 2;
      const cy = y + element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      return `    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${elementStrokeColor}" fill="${svgFillColor}"${rotateAttr}/>\n`;
    } else if (element.type === 'diamond') {
      const topX = x + element.width / 2;
      const topY = y;
      const rightX = x + element.width;
      const rightY = y + element.height / 2;
      const bottomX = x + element.width / 2;
      const bottomY = y + element.height;
      const leftX = x;
      const leftY = y + element.height / 2;
      return `    <polygon points="${topX},${topY} ${rightX},${rightY} ${bottomX},${bottomY} ${leftX},${leftY}" stroke="${elementStrokeColor}" fill="${svgFillColor}"${rotateAttr}/>\n`;
    } else if (element.type === 'text') {
      const textEl = element as TextElement;
      const fontSize = textEl.fontSize || (element as ComponentElementDef).fontSize || 16;
      const fontWeight = textEl.fontWeight || (element as ComponentElementDef).fontWeight || 'normal';
      const fontStyle = textEl.fontStyle || (element as ComponentElementDef).fontStyle || 'normal';
      const textAlign = textEl.textAlign || (element as ComponentElementDef).textAlign || 'left';
      const lineHeight = textEl.lineHeight || (element as ComponentElementDef).lineHeight || Math.round(fontSize * 1.5);
      const textContent = content ?? (textEl.content || (element as ComponentElementDef).content || '');

      let textX: number;
      let anchor: string;
      switch (textAlign) {
        case 'center':
          textX = x + element.width / 2;
          anchor = 'middle';
          break;
        case 'right':
          textX = x + element.width - TEXT_PADDING;
          anchor = 'end';
          break;
        default:
          textX = x + TEXT_PADDING;
          anchor = 'start';
      }

      const style = `font-size:${fontSize}px;font-weight:${fontWeight};font-style:${fontStyle};font-family:sans-serif`;

      // Create offscreen canvas to measure text for wrapping
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d');
      let lines: string[] = [textContent];

      if (measureCtx) {
        measureCtx.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
        const maxWidth = element.width - TEXT_PADDING * 2;
        lines = wrapText(measureCtx, textContent, maxWidth);
      }

      // Build SVG text element with tspan for each line
      const textY = y + fontSize;
      const escapeLine = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      if (lines.length === 1) {
        return `    <text x="${textX}" y="${textY}" fill="${elementStrokeColor}" text-anchor="${anchor}" style="${style}">${escapeLine(lines[0])}</text>\n`;
      } else {
        let result = `    <text x="${textX}" y="${textY}" fill="${elementStrokeColor}" text-anchor="${anchor}" style="${style}">\n`;
        lines.forEach((line, index) => {
          const dy = index === 0 ? 0 : lineHeight;
          result += `      <tspan x="${textX}" dy="${dy}">${escapeLine(line)}</tspan>\n`;
        });
        result += `    </text>\n`;
        return result;
      }
    }
    return '';
  };

  const exportSVG = () => {
    if (!hasExportableContent) {
      addToast({
        type: 'warning',
        title: 'Nothing to export',
        message: 'Add some elements to the canvas first.',
      });
      setIsOpen(false);
      return;
    }

    try {
      const bounds = getBoundingBox();
      const defaultSketchColor = DEFAULT_STROKE_COLOR;

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">
  <rect width="100%" height="100%" fill="${EXPORT_BG_COLOR}"/>
  <g stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
`;

      // Render visible elements
      visibleElements.forEach((element) => {
        const x = element.x - bounds.x;
        const y = element.y - bounds.y;

        if (element.type === 'arrow') {
          const arrowEl = element as ArrowElement;
          const startX = arrowEl.startX - bounds.x;
          const startY = arrowEl.startY - bounds.y;
          const endX = arrowEl.endX - bounds.x;
          const endY = arrowEl.endY - bounds.y;
          const elementStrokeColor = element.style?.strokeColor || defaultSketchColor;

          svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${elementStrokeColor}"/>\n`;

          // Arrowhead
          const angle = Math.atan2(endY - startY, endX - startX);
          const head1X = endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
          const head1Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
          const head2X = endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
          const head2Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

          svgContent += `    <line x1="${endX}" y1="${endY}" x2="${head1X}" y2="${head1Y}" stroke="${elementStrokeColor}"/>\n`;
          svgContent += `    <line x1="${endX}" y1="${endY}" x2="${head2X}" y2="${head2Y}" stroke="${elementStrokeColor}"/>\n`;
        } else if (element.type === 'line') {
          const lineEl = element as LineElement;
          const startX = lineEl.startX - bounds.x;
          const startY = lineEl.startY - bounds.y;
          const endX = lineEl.endX - bounds.x;
          const endY = lineEl.endY - bounds.y;
          const elementStrokeColor = element.style?.strokeColor || defaultSketchColor;

          svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${elementStrokeColor}"/>\n`;
        } else if (element.type === 'freedraw') {
          const freedrawEl = element as FreedrawElement;
          if (freedrawEl.points.length >= 2) {
            const elementStrokeColor = element.style?.strokeColor || defaultSketchColor;
            const pathPoints = freedrawEl.points.map((p, i) => {
              const px = p.x - bounds.x;
              const py = p.y - bounds.y;
              return i === 0 ? `M${px},${py}` : `L${px},${py}`;
            }).join(' ');
            svgContent += `    <path d="${pathPoints}" stroke="${elementStrokeColor}" fill="none"/>\n`;
          }
        } else {
          svgContent += elementToSvg(element, x, y, defaultSketchColor);
        }
      });

      // Render component instances
      frameInstances.forEach((instance) => {
        const component = userComponents.find(c => c.id === instance.componentId);
        if (!component) return;

        component.masterElements.forEach((def) => {
          const x = instance.x + def.offsetX - bounds.x;
          const y = instance.y + def.offsetY - bounds.y;
          const elementStrokeColor = def.style?.strokeColor || defaultSketchColor;

          if (def.type === 'text') {
            const override = instance.overrides?.find(o => o.elementId === def.id && o.property === 'content');
            const content = override ? String(override.value) : (def.content || '');
            svgContent += elementToSvg(def as unknown as CanvasElement, x, y, defaultSketchColor, content);
          } else if (def.type === 'arrow') {
            const startX = instance.x + (def.startX || 0) - bounds.x;
            const startY = instance.y + (def.startY || 0) - bounds.y;
            const endX = instance.x + (def.endX || 0) - bounds.x;
            const endY = instance.y + (def.endY || 0) - bounds.y;

            svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${elementStrokeColor}"/>\n`;

            const angle = Math.atan2(endY - startY, endX - startX);
            const head1X = endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
            const head1Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
            const head2X = endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
            const head2Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

            svgContent += `    <line x1="${endX}" y1="${endY}" x2="${head1X}" y2="${head1Y}" stroke="${elementStrokeColor}"/>\n`;
            svgContent += `    <line x1="${endX}" y1="${endY}" x2="${head2X}" y2="${head2Y}" stroke="${elementStrokeColor}"/>\n`;
          } else if (def.type === 'line') {
            const startX = instance.x + (def.startX || 0) - bounds.x;
            const startY = instance.y + (def.startY || 0) - bounds.y;
            const endX = instance.x + (def.endX || 0) - bounds.x;
            const endY = instance.y + (def.endY || 0) - bounds.y;

            svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${elementStrokeColor}"/>\n`;
          } else if (def.type === 'freedraw' && def.points) {
            const pathPoints = def.points.map((p, i) => {
              const px = instance.x + p.x - bounds.x;
              const py = instance.y + p.y - bounds.y;
              return i === 0 ? `M${px},${py}` : `L${px},${py}`;
            }).join(' ');
            svgContent += `    <path d="${pathPoints}" stroke="${elementStrokeColor}" fill="none"/>\n`;
          } else {
            svgContent += elementToSvg(def as unknown as CanvasElement, x, y, defaultSketchColor);
          }
        });
      });

      svgContent += `  </g>
</svg>`;

      // Download
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${frameName}-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      const totalItems = visibleElements.length + frameInstances.length;
      addToast({
        type: 'success',
        title: 'SVG exported',
        message: `Exported ${totalItems} item(s) as SVG`,
      });
    } catch (error) {
      console.error('SVG export failed:', error);
      addToast({
        type: 'error',
        title: 'Export failed',
        message: 'Failed to export SVG. Please try again.',
      });
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleDropdownKeyDown}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          // Open dropdown on ArrowDown when closed
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-150 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Image size={16} />
        <span>Export Image</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden"
          role="menu"
          aria-label="Image export options"
          aria-orientation="vertical"
        >
          {/* Preview section */}
          {previewDataUrl && previewDimensions ? (
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Preview ({previewDimensions.width} × {previewDimensions.height}px)
              </div>
              <div className="flex justify-center bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700 p-2">
                <img
                  src={previewDataUrl}
                  alt="Export preview"
                  className="max-w-full h-auto rounded"
                  style={{ maxHeight: PREVIEW_MAX_HEIGHT }}
                />
              </div>
            </div>
          ) : !hasExportableContent ? (
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                No elements to export
              </div>
            </div>
          ) : null}

          <button
            ref={(el) => { menuItemRefs.current[0] = el; }}
            onClick={exportPNG}
            onMouseEnter={() => setFocusedIndex(0)}
            tabIndex={focusedIndex === 0 ? 0 : -1}
            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-700"
            role="menuitem"
          >
            <Image size={16} />
            Export as PNG
          </button>
          <button
            ref={(el) => { menuItemRefs.current[1] = el; }}
            onClick={exportSVG}
            onMouseEnter={() => setFocusedIndex(1)}
            tabIndex={focusedIndex === 1 ? 0 : -1}
            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors focus:outline-none focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-700"
            role="menuitem"
          >
            <FileCode size={16} />
            Export as SVG
          </button>
        </div>
      )}
    </div>
  );
}

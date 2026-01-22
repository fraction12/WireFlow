'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Image, FileCode, ChevronDown } from 'lucide-react';
import type {
  CanvasElement,
  TextElement,
  ArrowElement,
  LineElement,
  FreedrawElement,
} from '@/lib/types';
import { useToast } from '../ui/Toast';
import { wrapText } from '../canvas-core/renderers';

// Maximum canvas dimension supported by browsers
// Most browsers support up to 32767 pixels per dimension
const MAX_CANVAS_DIMENSION = 32767;

interface ImageExportProps {
  elements: CanvasElement[];
  frameName: string;
}

// Maximum preview thumbnail size
const PREVIEW_MAX_WIDTH = 200;
const PREVIEW_MAX_HEIGHT = 150;

export function ImageExport({ elements, frameName }: ImageExportProps) {
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

  // Sketch-style drawing functions (simplified versions for export)
  const SKETCH_AMPLITUDE = 1.5;
  const SEGMENT_DISTANCE = 20;
  const ARROW_HEAD_LENGTH = 15;

  const seededRandom = (seed: number): number => {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const wobble = (value: number, seed: number, amplitude: number = SKETCH_AMPLITUDE): number => {
    return value + (seededRandom(seed) - 0.5) * amplitude * 2;
  };

  const drawSketchLine = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number = 0
  ) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const segments = Math.max(2, Math.ceil(length / SEGMENT_DISTANCE));

    ctx.beginPath();
    ctx.moveTo(wobble(x1, seed), wobble(y1, seed + 1));

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + dx * t;
      const y = y1 + dy * t;
      ctx.lineTo(wobble(x, seed + i * 2), wobble(y, seed + i * 2 + 1));
    }

    ctx.stroke();
  };

  const drawSketchRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    seed: number = 0
  ) => {
    drawSketchLine(ctx, x, y, x + width, y, seed);
    drawSketchLine(ctx, x + width, y, x + width, y + height, seed + 100);
    drawSketchLine(ctx, x + width, y + height, x, y + height, seed + 200);
    drawSketchLine(ctx, x, y + height, x, y, seed + 300);
  };

  const drawSketchEllipse = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    seed: number = 0
  ) => {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radiusX = width / 2;
    const radiusY = height / 2;
    const segments = Math.max(12, Math.ceil((radiusX + radiusY) / 10));

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const px = centerX + Math.cos(angle) * radiusX;
      const py = centerY + Math.sin(angle) * radiusY;
      const wobbleX = wobble(px, seed + i * 2);
      const wobbleY = wobble(py, seed + i * 2 + 1);

      if (i === 0) {
        ctx.moveTo(wobbleX, wobbleY);
      } else {
        ctx.lineTo(wobbleX, wobbleY);
      }
    }
    ctx.closePath();
    ctx.stroke();
  };

  const drawSketchDiamond = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    seed: number = 0
  ) => {
    const topX = x + width / 2, topY = y;
    const rightX = x + width, rightY = y + height / 2;
    const bottomX = x + width / 2, bottomY = y + height;
    const leftX = x, leftY = y + height / 2;

    drawSketchLine(ctx, topX, topY, rightX, rightY, seed);
    drawSketchLine(ctx, rightX, rightY, bottomX, bottomY, seed + 1);
    drawSketchLine(ctx, bottomX, bottomY, leftX, leftY, seed + 2);
    drawSketchLine(ctx, leftX, leftY, topX, topY, seed + 3);
  };

  const drawFreedraw = (
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[]
  ) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    if (points.length > 1) {
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    ctx.stroke();
  };

  // Calculate bounding box for all elements
  const getBoundingBox = useCallback(() => {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    elements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    // Add padding
    const padding = 40;
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [elements]);

  // Render elements to canvas
  const renderToCanvas = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) => {
    const defaultSketchColor = '#6b7280';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    elements.forEach((element) => {
      const seed = parseInt(element.id.split('_')[1] || '0', 10) % 1000;
      const x = element.x - offsetX;
      const y = element.y - offsetY;

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
        const padding = 4; // Matches TEXT_PADDING from textMeasurement.ts

        ctx.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'alphabetic';

        let textX: number;
        switch (textAlign) {
          case 'center':
            textX = x + element.width / 2;
            break;
          case 'right':
            textX = x + element.width - padding;
            break;
          default:
            textX = x + padding;
        }

        // Use element's stroke color for text fill (matches Canvas.tsx behavior)
        ctx.fillStyle = elementStrokeColor;

        // Wrap text to fit within element width
        const maxWidth = element.width - padding * 2;
        const lines = wrapText(ctx, textEl.content || '', maxWidth);

        // Render each line of wrapped text
        lines.forEach((line, index) => {
          ctx.fillText(line, textX, y + fontSize + index * lineHeight);
        });
      } else if (element.type === 'arrow') {
        const arrowEl = element as ArrowElement;
        const startX = arrowEl.startX - offsetX;
        const startY = arrowEl.startY - offsetY;
        const endX = arrowEl.endX - offsetX;
        const endY = arrowEl.endY - offsetY;

        drawSketchLine(ctx, startX, startY, endX, endY, seed);

        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const head1X = endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
        const head1Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
        const head2X = endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
        const head2Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

        drawSketchLine(ctx, endX, endY, head1X, head1Y, seed + 10);
        drawSketchLine(ctx, endX, endY, head2X, head2Y, seed + 11);
      } else if (element.type === 'line') {
        const lineEl = element as LineElement;
        const startX = lineEl.startX - offsetX;
        const startY = lineEl.startY - offsetY;
        const endX = lineEl.endX - offsetX;
        const endY = lineEl.endY - offsetY;

        drawSketchLine(ctx, startX, startY, endX, endY, seed);
      } else if (element.type === 'freedraw') {
        const freedrawEl = element as FreedrawElement;
        const adjustedPoints = freedrawEl.points.map((p) => ({
          x: p.x - offsetX,
          y: p.y - offsetY,
        }));
        drawFreedraw(ctx, adjustedPoints);
      }
    });
  }, [elements]);

  // Generate preview when dropdown opens
  useEffect(() => {
    if (!isOpen || elements.length === 0) {
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
        ctx.fillStyle = '#ffffff';
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
  }, [isOpen, elements, getBoundingBox, renderToCanvas]);

  const exportPNG = () => {
    if (elements.length === 0) {
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale for retina
      ctx.scale(scale, scale);

      renderToCanvas(ctx, bounds.x, bounds.y);

      // Download
      const link = document.createElement('a');
      link.download = `${frameName}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      addToast({
        type: 'success',
        title: 'PNG exported',
        message: `Exported ${elements.length} element(s) as PNG`,
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

  const exportSVG = () => {
    if (elements.length === 0) {
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
      const defaultSketchColor = '#6b7280';

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">
  <rect width="100%" height="100%" fill="white"/>
  <g stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
`;

      elements.forEach((element) => {
        const x = element.x - bounds.x;
        const y = element.y - bounds.y;

        // Read element-specific colors or fall back to defaults
        const elementStrokeColor = element.style?.strokeColor || defaultSketchColor;
        const elementFillColor = element.style?.fillColor || 'transparent';
        // SVG uses "none" for transparent fill
        const svgFillColor = elementFillColor === 'transparent' ? 'none' : elementFillColor;

        // Calculate rotation transform for SVG
        const rotation = element.rotation || 0;
        const rotationDegrees = (rotation * 180) / Math.PI;
        const hasRotation = rotation !== 0 && element.type !== 'arrow' && element.type !== 'line' && element.type !== 'freedraw' && element.type !== 'text';
        const centerX = x + element.width / 2;
        const centerY = y + element.height / 2;
        const rotateAttr = hasRotation ? ` transform="rotate(${rotationDegrees.toFixed(2)} ${centerX.toFixed(2)} ${centerY.toFixed(2)})"` : '';

        if (element.type === 'rectangle') {
          svgContent += `    <rect x="${x}" y="${y}" width="${element.width}" height="${element.height}" stroke="${elementStrokeColor}" fill="${svgFillColor}"${rotateAttr}/>\n`;
        } else if (element.type === 'ellipse') {
          const cx = x + element.width / 2;
          const cy = y + element.height / 2;
          const rx = element.width / 2;
          const ry = element.height / 2;
          svgContent += `    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke="${elementStrokeColor}" fill="${svgFillColor}"${rotateAttr}/>\n`;
        } else if (element.type === 'diamond') {
          const topX = x + element.width / 2;
          const topY = y;
          const rightX = x + element.width;
          const rightY = y + element.height / 2;
          const bottomX = x + element.width / 2;
          const bottomY = y + element.height;
          const leftX = x;
          const leftY = y + element.height / 2;
          svgContent += `    <polygon points="${topX},${topY} ${rightX},${rightY} ${bottomX},${bottomY} ${leftX},${leftY}" stroke="${elementStrokeColor}" fill="${svgFillColor}"${rotateAttr}/>\n`;
        } else if (element.type === 'text') {
          const textEl = element as TextElement;
          const fontSize = textEl.fontSize || 16;
          const fontWeight = textEl.fontWeight || 'normal';
          const fontStyle = textEl.fontStyle || 'normal';
          const textAlign = textEl.textAlign || 'left';
          const lineHeight = textEl.lineHeight || Math.round(fontSize * 1.5);
          const padding = 4; // Matches TEXT_PADDING from textMeasurement.ts

          let textX: number;
          let anchor: string;
          switch (textAlign) {
            case 'center':
              textX = x + element.width / 2;
              anchor = 'middle';
              break;
            case 'right':
              textX = x + element.width - padding;
              anchor = 'end';
              break;
            default:
              textX = x + padding;
              anchor = 'start';
          }

          const style = `font-size:${fontSize}px;font-weight:${fontWeight};font-style:${fontStyle};font-family:sans-serif`;

          // Create offscreen canvas to measure text for wrapping
          const measureCanvas = document.createElement('canvas');
          const measureCtx = measureCanvas.getContext('2d');
          let lines: string[] = [textEl.content || ''];

          if (measureCtx) {
            measureCtx.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
            const maxWidth = element.width - padding * 2;
            lines = wrapText(measureCtx, textEl.content || '', maxWidth);
          }

          // Build SVG text element with tspan for each line
          const textY = y + fontSize;
          const escapeLine = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          if (lines.length === 1) {
            svgContent += `    <text x="${textX}" y="${textY}" fill="${elementStrokeColor}" text-anchor="${anchor}" style="${style}">${escapeLine(lines[0])}</text>\n`;
          } else {
            svgContent += `    <text x="${textX}" y="${textY}" fill="${elementStrokeColor}" text-anchor="${anchor}" style="${style}">\n`;
            lines.forEach((line, index) => {
              const dy = index === 0 ? 0 : lineHeight;
              svgContent += `      <tspan x="${textX}" dy="${dy}">${escapeLine(line)}</tspan>\n`;
            });
            svgContent += `    </text>\n`;
          }
        } else if (element.type === 'arrow') {
          const arrowEl = element as ArrowElement;
          const startX = arrowEl.startX - bounds.x;
          const startY = arrowEl.startY - bounds.y;
          const endX = arrowEl.endX - bounds.x;
          const endY = arrowEl.endY - bounds.y;

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

          svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${elementStrokeColor}"/>\n`;
        } else if (element.type === 'freedraw') {
          const freedrawEl = element as FreedrawElement;
          if (freedrawEl.points.length >= 2) {
            const pathPoints = freedrawEl.points.map((p, i) => {
              const px = p.x - bounds.x;
              const py = p.y - bounds.y;
              return i === 0 ? `M${px},${py}` : `L${px},${py}`;
            }).join(' ');
            svgContent += `    <path d="${pathPoints}" stroke="${elementStrokeColor}" fill="none"/>\n`;
          }
        }
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

      addToast({
        type: 'success',
        title: 'SVG exported',
        message: `Exported ${elements.length} element(s) as SVG`,
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
          ) : elements.length === 0 ? (
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

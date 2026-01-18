'use client';

import { useState, useRef, useEffect } from 'react';
import { Image, FileCode, ChevronDown } from 'lucide-react';
import type {
  CanvasElement,
  TextElement,
  ArrowElement,
  LineElement,
  FreedrawElement,
} from '@/lib/types';
import { useToast } from './ui/Toast';

interface ImageExportProps {
  elements: CanvasElement[];
  frameName: string;
}

export function ImageExport({ elements, frameName }: ImageExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  const getBoundingBox = () => {
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
  };

  // Render elements to canvas
  const renderToCanvas = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number) => {
    const sketchColor = '#6b7280';
    ctx.strokeStyle = sketchColor;
    ctx.fillStyle = sketchColor;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    elements.forEach((element) => {
      const seed = parseInt(element.id.split('_')[1] || '0', 10) % 1000;
      const x = element.x - offsetX;
      const y = element.y - offsetY;

      if (element.type === 'rectangle') {
        drawSketchRect(ctx, x, y, element.width, element.height, seed);
      } else if (element.type === 'ellipse') {
        drawSketchEllipse(ctx, x, y, element.width, element.height, seed);
      } else if (element.type === 'diamond') {
        drawSketchDiamond(ctx, x, y, element.width, element.height, seed);
      } else if (element.type === 'text') {
        const textEl = element as TextElement;
        const fontSize = textEl.fontSize || 16;
        const fontWeight = textEl.fontWeight || 'normal';
        const fontStyle = textEl.fontStyle || 'normal';
        const textAlign = textEl.textAlign || 'left';

        ctx.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`;
        ctx.textAlign = textAlign;
        ctx.textBaseline = 'top';

        let textX: number;
        switch (textAlign) {
          case 'center':
            textX = x + element.width / 2;
            break;
          case 'right':
            textX = x + element.width - 8;
            break;
          default:
            textX = x + 8;
        }

        ctx.fillText(textEl.content || '', textX, y + 8);
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
  };

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

    const bounds = getBoundingBox();
    const canvas = document.createElement('canvas');
    const scale = 2; // 2x for retina
    canvas.width = bounds.width * scale;
    canvas.height = bounds.height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    setIsOpen(false);
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

    const bounds = getBoundingBox();
    const sketchColor = '#6b7280';

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}">
  <rect width="100%" height="100%" fill="white"/>
  <g stroke="${sketchColor}" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
`;

    elements.forEach((element) => {
      const x = element.x - bounds.x;
      const y = element.y - bounds.y;

      if (element.type === 'rectangle') {
        svgContent += `    <rect x="${x}" y="${y}" width="${element.width}" height="${element.height}"/>\n`;
      } else if (element.type === 'ellipse') {
        const cx = x + element.width / 2;
        const cy = y + element.height / 2;
        const rx = element.width / 2;
        const ry = element.height / 2;
        svgContent += `    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>\n`;
      } else if (element.type === 'diamond') {
        const topX = x + element.width / 2;
        const topY = y;
        const rightX = x + element.width;
        const rightY = y + element.height / 2;
        const bottomX = x + element.width / 2;
        const bottomY = y + element.height;
        const leftX = x;
        const leftY = y + element.height / 2;
        svgContent += `    <polygon points="${topX},${topY} ${rightX},${rightY} ${bottomX},${bottomY} ${leftX},${leftY}"/>\n`;
      } else if (element.type === 'text') {
        const textEl = element as TextElement;
        const fontSize = textEl.fontSize || 16;
        const fontWeight = textEl.fontWeight || 'normal';
        const fontStyle = textEl.fontStyle || 'normal';
        const textAlign = textEl.textAlign || 'left';

        let textX: number;
        let anchor: string;
        switch (textAlign) {
          case 'center':
            textX = x + element.width / 2;
            anchor = 'middle';
            break;
          case 'right':
            textX = x + element.width - 8;
            anchor = 'end';
            break;
          default:
            textX = x + 8;
            anchor = 'start';
        }

        const textY = y + fontSize + 8;
        const style = `font-size:${fontSize}px;font-weight:${fontWeight};font-style:${fontStyle};font-family:sans-serif`;
        const escapedContent = (textEl.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        svgContent += `    <text x="${textX}" y="${textY}" fill="${sketchColor}" text-anchor="${anchor}" style="${style}">${escapedContent}</text>\n`;
      } else if (element.type === 'arrow') {
        const arrowEl = element as ArrowElement;
        const startX = arrowEl.startX - bounds.x;
        const startY = arrowEl.startY - bounds.y;
        const endX = arrowEl.endX - bounds.x;
        const endY = arrowEl.endY - bounds.y;

        svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"/>\n`;

        // Arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const head1X = endX - ARROW_HEAD_LENGTH * Math.cos(angle - Math.PI / 6);
        const head1Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle - Math.PI / 6);
        const head2X = endX - ARROW_HEAD_LENGTH * Math.cos(angle + Math.PI / 6);
        const head2Y = endY - ARROW_HEAD_LENGTH * Math.sin(angle + Math.PI / 6);

        svgContent += `    <line x1="${endX}" y1="${endY}" x2="${head1X}" y2="${head1Y}"/>\n`;
        svgContent += `    <line x1="${endX}" y1="${endY}" x2="${head2X}" y2="${head2Y}"/>\n`;
      } else if (element.type === 'line') {
        const lineEl = element as LineElement;
        const startX = lineEl.startX - bounds.x;
        const startY = lineEl.startY - bounds.y;
        const endX = lineEl.endX - bounds.x;
        const endY = lineEl.endY - bounds.y;

        svgContent += `    <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"/>\n`;
      } else if (element.type === 'freedraw') {
        const freedrawEl = element as FreedrawElement;
        if (freedrawEl.points.length >= 2) {
          const pathPoints = freedrawEl.points.map((p, i) => {
            const px = p.x - bounds.x;
            const py = p.y - bounds.y;
            return i === 0 ? `M${px},${py}` : `L${px},${py}`;
          }).join(' ');
          svgContent += `    <path d="${pathPoints}"/>\n`;
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
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-150 flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Image size={16} />
        <span>Export Image</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-50 overflow-hidden">
          <button
            onClick={exportPNG}
            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors"
          >
            <Image size={16} />
            Export as PNG
          </button>
          <button
            onClick={exportSVG}
            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors"
          >
            <FileCode size={16} />
            Export as SVG
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import type { Tool } from '@/lib/types';

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export function Toolbar({ currentTool, onToolChange }: ToolbarProps) {
  // Excalidraw-style tools: select, rectangle, ellipse, arrow, line, text
  const tools: { name: Tool; label: string; icon: string }[] = [
    { name: 'select', label: 'Select (V)', icon: '⌖' },
    { name: 'rectangle', label: 'Rectangle (R)', icon: '□' },
    { name: 'ellipse', label: 'Ellipse (O)', icon: '○' },
    { name: 'arrow', label: 'Arrow (A)', icon: '→' },
    { name: 'line', label: 'Line (L)', icon: '─' },
    { name: 'text', label: 'Text (T)', icon: 'T' },
  ];

  return (
    <aside className="w-16 bg-white border-r border-zinc-200 flex flex-col items-center py-4 gap-1" aria-label="Drawing tools">
      {tools.map((tool) => (
        <button
          key={tool.name}
          onClick={() => onToolChange(tool.name)}
          className={`
            w-12 h-12 flex items-center justify-center text-2xl rounded-lg
            transition-colors
            ${currentTool === tool.name
              ? 'bg-blue-100 text-blue-800'
              : 'text-zinc-700 hover:bg-zinc-100'
            }
          `}
          title={tool.label}
          aria-label={tool.label}
          aria-pressed={currentTool === tool.name}
        >
          {tool.icon}
        </button>
      ))}
    </aside>
  );
}

'use client';

import type { Tool } from '@/lib/types';

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export function Toolbar({ currentTool, onToolChange }: ToolbarProps) {
  const tools: { name: Tool; label: string; icon: string }[] = [
    { name: 'select', label: 'Select', icon: '⌖' },
    { name: 'rectangle', label: 'Rectangle', icon: '□' },
    { name: 'text', label: 'Text', icon: 'T' },
    { name: 'arrow', label: 'Arrow', icon: '→' },
  ];

  return (
    <div className="w-16 bg-white border-r border-zinc-200 flex flex-col items-center py-4 gap-2">
      {tools.map((tool) => (
        <button
          key={tool.name}
          onClick={() => onToolChange(tool.name)}
          className={`
            w-12 h-12 flex items-center justify-center text-2xl rounded-lg
            transition-colors
            ${currentTool === tool.name
              ? 'bg-blue-100 text-blue-600'
              : 'text-zinc-600 hover:bg-zinc-100'
            }
          `}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

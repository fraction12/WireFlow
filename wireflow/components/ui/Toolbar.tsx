'use client';

import type { Tool } from '@/lib/types';
import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  ArrowRight,
  Minus,
  Type,
  Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export function Toolbar({ currentTool, onToolChange }: ToolbarProps) {
  const tools: { name: Tool; label: string; shortcut: string; icon: LucideIcon }[] = [
    { name: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
    { name: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
    { name: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle },
    { name: 'diamond', label: 'Diamond', shortcut: 'D', icon: Diamond },
    { name: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowRight },
    { name: 'line', label: 'Line', shortcut: 'L', icon: Minus },
    { name: 'freedraw', label: 'Pencil', shortcut: 'P', icon: Pencil },
    { name: 'text', label: 'Text', shortcut: 'T', icon: Type },
  ];

  return (
    <aside
      className="w-16 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col items-center py-4 gap-1"
      aria-label="Drawing tools"
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = currentTool === tool.name;
        const fullLabel = `${tool.label} (${tool.shortcut})`;

        const descriptionId = `toolbar-${tool.name}-shortcut`;
        return (
          <div key={tool.name} className="relative">
            <button
              onClick={() => onToolChange(tool.name)}
              className={`
                relative w-12 h-12 flex items-center justify-center rounded-lg
                transition-all duration-150 ease-out cursor-pointer
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
                active:scale-95
                ${isActive
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }
              `}
              title={fullLabel}
              aria-label={tool.label}
              aria-describedby={descriptionId}
              aria-pressed={isActive}
            >
              <Icon size={22} strokeWidth={isActive ? 2 : 1.5} />
              <span
                className={`
                  absolute bottom-0.5 right-0.5 text-[9px] font-medium leading-none
                  ${isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-400 dark:text-zinc-500'
                  }
                `}
                aria-hidden="true"
              >
                {tool.shortcut}
              </span>
            </button>
            <span id={descriptionId} className="sr-only">
              Keyboard shortcut: {tool.shortcut}
            </span>
          </div>
        );
      })}
    </aside>
  );
}

'use client';

import type { Tool } from '@/lib/types';

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export function Toolbar({ currentTool, onToolChange }: ToolbarProps) {
  const tools: { name: Tool; label: string; icon: string; category?: string }[] = [
    { name: 'select', label: 'Select', icon: '⌖' },

    // Basic Shapes
    { name: 'rectangle', label: 'Rectangle', icon: '□' },
    { name: 'text', label: 'Text', icon: 'T' },
    { name: 'arrow', label: 'Arrow', icon: '→' },

    // Layout & Structure
    { name: 'divider', label: 'Divider', icon: '─', category: 'Layout' },

    // UI Intent
    { name: 'button', label: 'Button', icon: '⏏', category: 'UI' },
    { name: 'input', label: 'Input Field', icon: '▭', category: 'UI' },
    { name: 'checkbox', label: 'Checkbox', icon: '☑', category: 'UI' },

    // Annotation
    { name: 'callout', label: 'Callout/Note', icon: '💬', category: 'Note' },
    { name: 'badge', label: 'State Badge', icon: '◆', category: 'Note' },
  ];

  // Group tools with dividers between categories
  const renderTools = () => {
    const elements: JSX.Element[] = [];
    let lastCategory: string | undefined = undefined;

    tools.forEach((tool, index) => {
      // Add visual separator between categories
      if (lastCategory !== undefined && tool.category !== lastCategory && tool.category !== undefined) {
        elements.push(
          <div key={`sep-${index}`} className="w-10 h-px bg-zinc-300 my-1" />
        );
      }

      elements.push(
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
      );

      lastCategory = tool.category;
    });

    return elements;
  };

  return (
    <aside className="w-16 bg-white border-r border-zinc-200 flex flex-col items-center py-4 gap-2 overflow-y-auto" aria-label="Drawing tools">
      {renderTools()}
    </aside>
  );
}

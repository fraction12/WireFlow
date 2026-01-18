'use client';

import { useState } from 'react';
import type { ComponentTemplate, ComponentType } from '@/lib/types';
import { COMPONENT_TEMPLATES } from '@/lib/componentTemplates';
import {
  Menu,
  ChevronRight,
  Table2,
  Filter,
  CircleDashed,
  AlertTriangle,
  FormInput,
  RectangleHorizontal,
  Square,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ComponentPanelProps {
  onInsertComponent: (template: ComponentTemplate) => void;
}

export function ComponentPanel({ onInsertComponent }: ComponentPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ComponentType>('all');

  const categories: Array<{ id: 'all' | ComponentType; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'table', label: 'Tables' },
    { id: 'empty-state', label: 'States' },
    { id: 'confirmation-modal', label: 'Modals' },
    { id: 'simple-form', label: 'Forms' },
  ];

  const filteredTemplates = selectedCategory === 'all'
    ? COMPONENT_TEMPLATES
    : COMPONENT_TEMPLATES.filter(t => {
        // Group table and table-filters under 'table' category
        if (selectedCategory === 'table') {
          return t.type === 'table' || t.type === 'table-filters';
        }
        return t.type === selectedCategory;
      });

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-10 h-10 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Show Components"
          aria-label="Show components panel"
          aria-expanded="false"
        >
          <Menu size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Components</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-8 h-8 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Hide panel"
          aria-label="Hide components panel"
          aria-expanded="true"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Category filter */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                selectedCategory === cat.id
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 font-medium'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              aria-pressed={selectedCategory === cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
            <CircleDashed size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No components available</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <ComponentPreview
              key={template.id}
              template={template}
              onInsert={onInsertComponent}
            />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">
        Click a component to insert it at canvas center
      </div>
    </div>
  );
}

interface ComponentPreviewProps {
  template: ComponentTemplate;
  onInsert: (template: ComponentTemplate) => void;
}

function ComponentPreview({ template, onInsert }: ComponentPreviewProps) {
  const Icon = getComponentIcon(template.type);

  return (
    <button
      onClick={() => onInsert(template)}
      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-150 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.98]"
    >
      {/* Preview thumbnail */}
      <div className="w-full h-24 bg-zinc-50 dark:bg-zinc-800 rounded mb-2 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <Icon
          size={40}
          className="text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-150"
          strokeWidth={1.5}
        />
      </div>

      {/* Name and description */}
      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">
        {template.name}
      </div>
      <div className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
        {template.description}
      </div>

      {/* Metadata */}
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
        <span>{template.elements.length} elements</span>
        <span>•</span>
        <span>{template.width}×{template.height}</span>
      </div>
    </button>
  );
}

function getComponentIcon(type: ComponentType): LucideIcon {
  const icons: Record<ComponentType, LucideIcon> = {
    'table': Table2,
    'table-filters': Filter,
    'empty-state': CircleDashed,
    'confirmation-modal': AlertTriangle,
    'simple-form': FormInput,
    'action-footer': RectangleHorizontal,
  };
  return icons[type] || Square;
}

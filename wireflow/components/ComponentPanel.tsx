'use client';

import { useState } from 'react';
import type { ComponentTemplate, ComponentType } from '@/lib/types';
import { COMPONENT_TEMPLATES } from '@/lib/componentTemplates';

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
      <div className="w-12 bg-white border-l border-zinc-200 flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          title="Show Components"
        >
          ☰
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 bg-white border-l border-zinc-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 flex justify-between items-center">
        <h2 className="font-semibold text-zinc-900">Components</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-zinc-500 hover:text-zinc-600 text-xl leading-none"
          title="Hide panel"
        >
          ›
        </button>
      </div>

      {/* Category filter */}
      <div className="px-4 py-3 border-b border-zinc-200">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTemplates.map(template => (
          <ComponentPreview
            key={template.id}
            template={template}
            onInsert={onInsertComponent}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-zinc-200 text-xs text-zinc-600">
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
  return (
    <button
      onClick={() => onInsert(template)}
      className="w-full border border-zinc-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left group"
    >
      {/* Preview thumbnail */}
      <div className="w-full h-24 bg-zinc-50 rounded mb-2 flex items-center justify-center border border-zinc-200 overflow-hidden">
        <div className="text-4xl text-zinc-400 group-hover:text-blue-400 transition-colors">
          {getComponentIcon(template.type)}
        </div>
      </div>

      {/* Name and description */}
      <div className="font-medium text-sm text-zinc-900 mb-1">
        {template.name}
      </div>
      <div className="text-xs text-zinc-600 line-clamp-2">
        {template.description}
      </div>

      {/* Metadata */}
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
        <span>{template.elements.length} elements</span>
        <span>•</span>
        <span>{template.width}×{template.height}</span>
      </div>
    </button>
  );
}

function getComponentIcon(type: ComponentType): string {
  const icons: Record<ComponentType, string> = {
    'table': '⊞',
    'table-filters': '⊟',
    'empty-state': '○',
    'confirmation-modal': '⚠',
    'simple-form': '▭',
    'action-footer': '▬',
  };
  return icons[type] || '□';
}

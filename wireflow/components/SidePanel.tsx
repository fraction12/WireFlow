'use client';

import { useState } from 'react';
import type { CanvasElement, SemanticTag, TextElement } from '@/lib/types';

interface SidePanelProps {
  element: CanvasElement;
  onUpdateElement: (element: CanvasElement) => void;
  onClose: () => void;
  onDelete: () => void;
  onUngroupComponent?: (groupId: string) => void;
  groupElementCount?: number;
}

export function SidePanel({ element, onUpdateElement, onClose, onDelete, onUngroupComponent, groupElementCount }: SidePanelProps) {
  const [localElement, setLocalElement] = useState(element);

  const handleTagChange = (tag: SemanticTag) => {
    const updated = { ...localElement, semanticTag: tag };
    setLocalElement(updated);
    onUpdateElement(updated);
  };

  const handleFieldChange = (field: 'description' | 'intendedBehavior' | 'acceptanceNotes', value: string) => {
    const updated = { ...localElement, [field]: value };
    setLocalElement(updated);
    onUpdateElement(updated);
  };

  const handleTextContentChange = (value: string) => {
    if (localElement.type === 'text') {
      const updated = { ...localElement, content: value } as TextElement;
      setLocalElement(updated);
      onUpdateElement(updated);
    }
  };

  const semanticTags: { value: SemanticTag; label: string }[] = [
    { value: null, label: 'None' },
    { value: 'button', label: 'Button' },
    { value: 'input', label: 'Input' },
    { value: 'section', label: 'Section' },
  ];

  return (
    <aside className="w-80 bg-white border-l border-zinc-200 flex flex-col h-full" aria-label="Element properties">
      <div className="px-4 py-3 border-b border-zinc-200 flex justify-between items-center">
        <h2 className="font-semibold text-zinc-900">Properties</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-sm font-medium transition-colors"
            title="Delete element (Del)"
            aria-label="Delete element"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-600 text-xl leading-none"
            aria-label="Close properties panel"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-2">
            Element Type
          </label>
          <div className="text-sm text-zinc-900 capitalize bg-zinc-50 px-3 py-2 rounded">
            {element.type}
          </div>
        </div>

        {localElement.groupId && onUngroupComponent && (
          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-900">
                Part of {localElement.componentType} component
              </span>
              <button
                onClick={() => onUngroupComponent(localElement.groupId!)}
                className="text-xs text-purple-700 hover:text-purple-900 font-medium"
              >
                Ungroup
              </button>
            </div>
            {groupElementCount && (
              <div className="text-xs text-purple-700">
                {groupElementCount} elements grouped
              </div>
            )}
          </div>
        )}

        {element.type === 'text' && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-2">
              Text Content
            </label>
            <input
              type="text"
              value={(localElement as TextElement).content || ''}
              onChange={(e) => handleTextContentChange(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-2">
            Semantic Tag
          </label>
          <div className="grid grid-cols-2 gap-2">
            {semanticTags.map((tag) => (
              <button
                key={tag.label}
                onClick={() => handleTagChange(tag.value)}
                className={`
                  px-3 py-2 text-sm rounded border transition-colors
                  ${localElement.semanticTag === tag.value
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-400'
                  }
                `}
                aria-label={`Tag as ${tag.label}`}
                aria-pressed={localElement.semanticTag === tag.value}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {localElement.semanticTag && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Description
              </label>
              <textarea
                value={localElement.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="What is this element?"
                className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-zinc-600 placeholder:opacity-100"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Intended Behavior
              </label>
              <textarea
                value={localElement.intendedBehavior || ''}
                onChange={(e) => handleFieldChange('intendedBehavior', e.target.value)}
                placeholder="What should this do when interacted with?"
                className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-zinc-600 placeholder:opacity-100"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-2">
                Acceptance Notes
              </label>
              <textarea
                value={localElement.acceptanceNotes || ''}
                onChange={(e) => handleFieldChange('acceptanceNotes', e.target.value)}
                placeholder="How will we verify this works correctly?"
                className="w-full px-3 py-2 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-zinc-600 placeholder:opacity-100"
                rows={4}
              />
            </div>
          </>
        )}

        {!localElement.semanticTag && (
          <div className="bg-zinc-50 rounded p-3 text-sm text-zinc-600">
            <p className="font-medium mb-1">No semantic tag</p>
            <p className="text-xs">
              This element is part of the visual sketch. Add a semantic tag to include it in the export.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

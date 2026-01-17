'use client';

import { useState } from 'react';
import type { Frame, FrameType } from '@/lib/types';

interface FrameListProps {
  frames: Frame[];
  activeFrameId: string | null;
  onSwitchFrame: (frameId: string) => void;
  onCreateFrame: (type: FrameType) => void;
  onRenameFrame: (frameId: string, newName: string) => void;
  onDeleteFrame: (frameId: string) => void;
}

export function FrameList({
  frames,
  activeFrameId,
  onSwitchFrame,
  onCreateFrame,
  onRenameFrame,
  onDeleteFrame,
}: FrameListProps) {
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);

  const handleCreateFrame = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as FrameType;
    if (type) {
      onCreateFrame(type);
      e.target.value = ''; // Reset dropdown
    }
  };

  return (
    <div className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full">
      {/* Header with "Add Frame" dropdown */}
      <div className="px-4 py-3 border-b border-zinc-200">
        <h2 className="font-semibold text-zinc-900 mb-2">Frames</h2>

        <select
          onChange={handleCreateFrame}
          className="w-full px-3 py-2 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900"
          defaultValue=""
        >
          <option value="" disabled className="text-zinc-600">
            + New Frame
          </option>
          <option value="page" className="text-zinc-900">Page</option>
          <option value="modal" className="text-zinc-900">Modal</option>
          <option value="flyout" className="text-zinc-900">Flyout</option>
        </select>
      </div>

      {/* Frame list */}
      <div className="flex-1 overflow-y-auto">
        {frames.map((frame) => {
          const isActive = frame.id === activeFrameId;
          const isEditing = frame.id === editingFrameId;

          return (
            <div
              key={frame.id}
              className={`px-4 py-3 border-b border-zinc-100 cursor-pointer transition-colors ${
                isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-zinc-50'
              }`}
              onClick={() => !isEditing && onSwitchFrame(frame.id)}
            >
              {/* Frame name (editable) */}
              <div className="mb-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={frame.name}
                    onChange={(e) => onRenameFrame(frame.id, e.target.value)}
                    onBlur={() => setEditingFrameId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingFrameId(null);
                      if (e.key === 'Escape') setEditingFrameId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full font-medium text-sm px-1 py-0.5 border border-blue-500 rounded focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <div
                    className="font-medium text-sm text-zinc-900 cursor-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFrameId(frame.id);
                    }}
                  >
                    {frame.name}
                  </div>
                )}
              </div>

              {/* Frame metadata */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {/* Frame type badge */}
                  <span
                    className={`px-2 py-0.5 rounded capitalize ${
                      frame.type === 'page'
                        ? 'bg-blue-100 text-blue-800'
                        : frame.type === 'modal'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {frame.type}
                  </span>

                  {/* Element count */}
                  <span className="text-zinc-600">{frame.elements.length} elements</span>
                </div>

                {/* Delete button (only if not last frame) */}
                {frames.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete frame "${frame.name}"?`)) {
                        onDeleteFrame(frame.id);
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                    title="Delete frame"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { Frame, FrameType } from '@/lib/types';
import { Trash2 } from 'lucide-react';

interface FrameListProps {
  frames: Frame[];
  activeFrameId: string | null;
  onSwitchFrame: (frameId: string) => void;
  onCreateFrame: (type: FrameType) => void;
  onRenameFrame: (frameId: string, newName: string) => void;
  onDeleteFrame: (frameId: string) => void;
  onRequestDeleteFrame?: (frameId: string, frameName: string) => void;
}

export function FrameList({
  frames,
  activeFrameId,
  onSwitchFrame,
  onCreateFrame,
  onRenameFrame,
  onDeleteFrame,
  onRequestDeleteFrame,
}: FrameListProps) {
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);

  const handleCreateFrame = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as FrameType;
    if (type) {
      onCreateFrame(type);
      e.target.value = ''; // Reset dropdown
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, frame: Frame) => {
    e.stopPropagation();
    if (onRequestDeleteFrame) {
      onRequestDeleteFrame(frame.id, frame.name);
    } else {
      // Fallback to direct delete with confirm
      if (confirm(`Delete frame "${frame.name}"?`)) {
        onDeleteFrame(frame.id);
      }
    }
  };

  return (
    <nav className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col h-full" aria-label="Frames navigation">
      {/* Header with "Add Frame" dropdown */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Frames</h2>

        <select
          onChange={handleCreateFrame}
          className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
          defaultValue=""
          aria-label="Create new frame"
        >
          <option value="" disabled className="text-zinc-600 dark:text-zinc-400">
            + New Frame
          </option>
          <option value="page" className="text-zinc-900 dark:text-zinc-100">Page</option>
          <option value="modal" className="text-zinc-900 dark:text-zinc-100">Modal</option>
          <option value="flyout" className="text-zinc-900 dark:text-zinc-100">Flyout</option>
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
              className={`px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-all duration-150 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
              onClick={() => !isEditing && onSwitchFrame(frame.id)}
              role="button"
              aria-current={isActive ? 'page' : undefined}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isEditing) {
                  onSwitchFrame(frame.id);
                }
              }}
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
                    className="w-full font-medium text-sm px-2 py-1 border border-blue-500 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <div
                    className="font-medium text-sm text-zinc-900 dark:text-zinc-100 cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFrameId(frame.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        setEditingFrameId(frame.id);
                      }
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
                    className={`px-2 py-0.5 rounded-md capitalize font-medium ${
                      frame.type === 'page'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : frame.type === 'modal'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    }`}
                  >
                    {frame.type}
                  </span>

                  {/* Element count */}
                  <span className="text-zinc-600 dark:text-zinc-400">{frame.elements.length} elements</span>
                </div>

                {/* Delete button (only if not last frame) */}
                {frames.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteClick(e, frame)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95"
                    title="Delete frame"
                    aria-label={`Delete frame ${frame.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

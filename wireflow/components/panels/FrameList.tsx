'use client';

import { useState, useRef, useEffect } from 'react';
import type { Frame, FrameType } from '@/lib/types';
import { usePanelAnimation } from '@/lib/usePanelAnimation';
import { Trash2, Plus, ChevronDown, ChevronLeft, AppWindow } from 'lucide-react';

interface FrameListProps {
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Callback when panel is toggled */
  onToggle: () => void;
  frames: Frame[];
  activeFrameId: string | null;
  onSwitchFrame: (frameId: string) => void;
  onCreateFrame: (type: FrameType) => void;
  onRenameFrame: (frameId: string, newName: string) => void;
  onDeleteFrame: (frameId: string) => void;
  onRequestDeleteFrame?: (frameId: string, frameName: string) => void;
}

export function FrameList({
  isExpanded,
  onToggle,
  frames,
  activeFrameId,
  onSwitchFrame,
  onCreateFrame,
  onRenameFrame,
  onDeleteFrame,
  onRequestDeleteFrame,
}: FrameListProps) {
  // Manage content visibility timing for smooth animation
  const contentVisible = usePanelAnimation(isExpanded);

  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleCreateFrame = (type: FrameType) => {
    onCreateFrame(type);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isDropdownOpen]);

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

  const frameTypes: Array<{ type: FrameType; label: string; description: string }> = [
    { type: 'page', label: 'Page', description: 'Full page layout' },
    { type: 'modal', label: 'Modal', description: 'Centered overlay dialog' },
    { type: 'flyout', label: 'Flyout', description: 'Side panel or drawer' },
  ];

  // Collapsed state - show slim strip with icon
  if (!isExpanded) {
    return (
      <nav
        className="w-12 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col items-center py-3 shrink-0 transition-all duration-200 motion-reduce:transition-none"
        aria-label="Frames navigation (collapsed)"
      >
        <button
          onClick={onToggle}
          className="w-10 h-10 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Expand frames panel"
          aria-label="Expand frames panel"
          aria-expanded={false}
        >
          <AppWindow size={20} />
        </button>
      </nav>
    );
  }

  return (
    <nav
      className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[50%] shrink-0 transition-all duration-200 motion-reduce:transition-none overflow-hidden"
      aria-label="Frames navigation"
    >
      {/* Content only visible after opening animation completes / before closing animation starts */}
      {contentVisible && (
        <>
          {/* Header with "Add Frame" dropdown */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Frames</h2>
          <button
            onClick={onToggle}
            className="w-7 h-7 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Collapse frames panel"
            aria-label="Collapse frames panel"
            aria-expanded={true}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Custom dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full px-3 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 flex items-center justify-between gap-2 active:scale-[0.98]"
            aria-label="Create new frame"
            aria-haspopup="true"
            aria-expanded={isDropdownOpen}
          >
            <span className="flex items-center gap-2">
              <Plus size={16} strokeWidth={2} />
              New Frame
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50 opacity-100 transition-opacity duration-150"
              role="menu"
              aria-label="Frame types"
            >
              {frameTypes.map((frameType) => (
                <button
                  key={frameType.type}
                  onClick={() => handleCreateFrame(frameType.type)}
                  className="w-full px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950 transition-all duration-150 focus:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-950 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 group"
                  role="menuitem"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        {frameType.label}
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {frameType.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Frame list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" role="list" aria-label="Frame list">
        {frames.map((frame) => {
          const isActive = frame.id === activeFrameId;
          const isEditing = frame.id === editingFrameId;

          return (
            <div
              key={frame.id}
              className={`group px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950 border-l-4 border-l-blue-500'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
              onClick={() => !isEditing && onSwitchFrame(frame.id)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                  e.preventDefault();
                  onSwitchFrame(frame.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Frame: ${frame.name}`}
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
                    aria-label="Rename frame"
                  />
                ) : (
                  <button
                    type="button"
                    className="font-medium text-sm text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded px-1 -mx-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFrameId(frame.id);
                    }}
                    aria-label={`Rename frame ${frame.name}`}
                  >
                    {frame.name}
                  </button>
                )}
              </div>

              {/* Frame metadata */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {/* Frame type badge */}
                  <span
                    className={`px-2 py-0.5 rounded-md capitalize font-medium select-none ${
                      frame.type === 'page'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                        : frame.type === 'modal'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                    }`}
                    aria-label={`Frame type: ${frame.type}`}
                  >
                    {frame.type}
                  </span>

                  {/* Element count */}
                  <span className="text-zinc-600 dark:text-zinc-400 select-none" aria-label={`${frame.elements.length} elements in frame`}>
                    {frame.elements.length} {frame.elements.length === 1 ? 'element' : 'elements'}
                  </span>
                </div>

                {/* Delete button (only if not last frame) - shows on hover/focus */}
                {frames.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, frame)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-95 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
        </>
      )}
    </nav>
  );
}

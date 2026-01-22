'use client';

import { useState } from 'react';
import type { FrameDocumentation, ElementAnnotation } from '@/lib/types';
import { usePanelAnimation } from '@/lib/usePanelAnimation';
import {
  FileText,
  ChevronRight,
} from 'lucide-react';

interface DocumentationPanelProps {
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Callback when panel is toggled */
  onToggle: () => void;
  /** Current frame name for display */
  frameName: string;
  /** Documentation for the current frame */
  frameDocumentation: FrameDocumentation | undefined;
  /** Callback when frame notes change */
  onFrameNotesChange: (notes: string) => void;
  /** Currently selected element ID (if any) */
  selectedElementId: string | null;
  /** Annotation for the selected element */
  elementAnnotation: ElementAnnotation | undefined;
  /** Callback when element annotation changes */
  onElementAnnotationChange: (annotation: ElementAnnotation) => void;
  /** Total number of elements in the frame */
  totalElements: number;
  /** Number of elements with annotations */
  annotatedCount: number;
}

/** Default empty annotation */
const EMPTY_ANNOTATION: ElementAnnotation = {
  description: '',
  behavior: '',
  edgeCases: '',
};

export function DocumentationPanel({
  isExpanded,
  onToggle,
  frameName,
  frameDocumentation,
  onFrameNotesChange,
  selectedElementId,
  elementAnnotation,
  onElementAnnotationChange,
  totalElements,
  annotatedCount,
}: DocumentationPanelProps) {
  // Manage content visibility timing for smooth animation
  const contentVisible = usePanelAnimation(isExpanded);

  // Get current values with defaults
  const notes = frameDocumentation?.notes || '';
  const annotation = elementAnnotation || EMPTY_ANNOTATION;

  // Handle annotation field changes
  const handleAnnotationChange = (field: keyof ElementAnnotation, value: string) => {
    onElementAnnotationChange({
      ...annotation,
      [field]: value,
    });
  };

  // Character count for notes
  const notesCharCount = notes.length;

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col h-full transition-all duration-200 motion-reduce:transition-none overflow-hidden ${
        isExpanded ? 'w-80' : 'w-0 border-l-0'
      }`}
    >
      {/* Content only visible after opening animation completes / before closing animation starts */}
      {contentVisible && (
        <>
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-zinc-500 dark:text-zinc-400" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Documentation</h2>
          {totalElements > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                annotatedCount === totalElements
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : annotatedCount > 0
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
              title={`${annotatedCount} of ${totalElements} elements annotated`}
            >
              {annotatedCount}/{totalElements}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Hide panel"
          aria-label="Hide documentation panel"
          aria-expanded={isExpanded}
        >
          <ChevronRight size={18} />
        </button>
          </div>

          {/* Frame name display */}
          <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Current Frame</div>
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{frameName}</div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Frame-level notes */}
            <div>
              <label htmlFor="frame-notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Frame Notes
              </label>
              <textarea
                id="frame-notes"
                value={notes}
                onChange={(e) => onFrameNotesChange(e.target.value)}
                placeholder="Add notes about this frame..."
                className="w-full h-40 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 text-right">
                {notesCharCount} characters
              </div>
            </div>

            {/* Element annotation section - only shown when element is selected */}
            {selectedElementId && (
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Element Annotation
                  </span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-mono truncate">
                  ID: {selectedElementId}
                </div>

                {/* Description field */}
                <div className="mb-3">
                  <label htmlFor="element-description" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Description
                  </label>
                  <textarea
                    id="element-description"
                    value={annotation.description}
                    onChange={(e) => handleAnnotationChange('description', e.target.value)}
                    placeholder="What is this element for?"
                    className="w-full h-20 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Behavior field */}
                <div className="mb-3">
                  <label htmlFor="element-behavior" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Behavior
                  </label>
                  <textarea
                    id="element-behavior"
                    value={annotation.behavior}
                    onChange={(e) => handleAnnotationChange('behavior', e.target.value)}
                    placeholder="How should this element behave?"
                    className="w-full h-20 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Edge Cases field */}
                <div>
                  <label htmlFor="element-edge-cases" className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Edge Cases
                  </label>
                  <textarea
                    id="element-edge-cases"
                    value={annotation.edgeCases}
                    onChange={(e) => handleAnnotationChange('edgeCases', e.target.value)}
                    placeholder="What edge cases should be handled?"
                    className="w-full h-20 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            )}

            {/* Empty state when no element selected */}
            {!selectedElementId && (
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">
                  {/* Empty state illustration - cursor selecting element */}
                  <svg
                    width="56"
                    height="56"
                    viewBox="0 0 56 56"
                    className="mx-auto mb-3 opacity-30"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Unselected element (rectangle) */}
                    <rect x="16" y="16" width="24" height="18" rx="2" strokeDasharray="3 2" />
                    {/* Cursor arrow */}
                    <path
                      d="M8 8 L8 26 L13 21 L18 30 L21 28 L16 19 L22 19 Z"
                      fill="currentColor"
                      stroke="none"
                      className="opacity-60"
                    />
                    {/* Document/annotation icon */}
                    <rect x="32" y="36" width="14" height="12" rx="1" />
                    <line x1="35" y1="40" x2="43" y2="40" />
                    <line x1="35" y1="44" x2="40" y2="44" />
                  </svg>
                  <p className="text-sm font-medium mb-1">No element selected</p>
                  <p className="text-xs opacity-70">Click an element to add documentation</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
            Ctrl+\ to toggle panel
          </div>
        </>
      )}
    </div>
  );
}

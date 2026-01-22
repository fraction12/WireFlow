'use client';

import { LayoutGrid, FileText, Layers } from 'lucide-react';

interface RightPanelStripProps {
  /** Whether the layers panel is expanded */
  layersPanelExpanded: boolean;
  /** Callback when layers panel is toggled */
  onToggleLayersPanel: () => void;
  /** Whether the component panel is expanded */
  componentPanelExpanded: boolean;
  /** Callback when component panel is toggled */
  onToggleComponentPanel: () => void;
  /** Whether the documentation panel is expanded */
  docPanelExpanded: boolean;
  /** Callback when documentation panel is toggled */
  onToggleDocPanel: () => void;
}

/**
 * A collapsed strip on the right side showing toggle buttons for
 * LayersPanel, ComponentPanel and DocumentationPanel when they are collapsed.
 */
export function RightPanelStrip({
  layersPanelExpanded,
  onToggleLayersPanel,
  componentPanelExpanded,
  onToggleComponentPanel,
  docPanelExpanded,
  onToggleDocPanel,
}: RightPanelStripProps) {
  // Only show the strip if at least one panel is collapsed
  if (layersPanelExpanded && componentPanelExpanded && docPanelExpanded) {
    return null;
  }

  return (
    <div className="w-12 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-700 flex flex-col items-center py-4 gap-2">
      {/* Layers panel toggle - only show when collapsed */}
      {!layersPanelExpanded && (
        <button
          onClick={onToggleLayersPanel}
          className="w-10 h-10 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Show Layers"
          aria-label="Show layers panel"
          aria-expanded="false"
        >
          <Layers size={20} />
        </button>
      )}

      {/* Component panel toggle - only show when collapsed */}
      {!componentPanelExpanded && (
        <button
          onClick={onToggleComponentPanel}
          className="w-10 h-10 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Show Components"
          aria-label="Show components panel"
          aria-expanded="false"
        >
          <LayoutGrid size={20} />
        </button>
      )}

      {/* Documentation panel toggle - only show when collapsed */}
      {!docPanelExpanded && (
        <button
          onClick={onToggleDocPanel}
          className="w-10 h-10 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
          title="Show Documentation (Ctrl+\)"
          aria-label="Show documentation panel"
          aria-expanded="false"
        >
          <FileText size={20} />
        </button>
      )}
    </div>
  );
}

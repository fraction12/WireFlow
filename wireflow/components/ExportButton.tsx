'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { Frame, ExportData, TextElement, FrameExport } from '@/lib/types';
import { useToast } from './ui/Toast';

interface ExportButtonProps {
  frames: Frame[];
}

export function ExportButton({ frames }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { addToast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);

    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // Transform frames to export format
      const frameExports: FrameExport[] = frames.map(frame => {
        // Filter tagged elements in this frame
        const taggedElements = frame.elements
          .filter(el => el.semanticTag)
          .map(el => ({
            id: el.id,
            type: el.type,
            position: { x: el.x, y: el.y },
            size: { width: el.width, height: el.height },
            semanticTag: el.semanticTag!,
            annotations: {
              description: el.description,
              intendedBehavior: el.intendedBehavior,
              acceptanceNotes: el.acceptanceNotes,
            },
            ...(el.type === 'text' && { content: (el as TextElement).content }),
            componentType: el.componentType,
            groupId: el.groupId,
            elementGroupId: el.elementGroupId,
          }));

        return {
          id: frame.id,
          name: frame.name,
          type: frame.type,
          taggedElements,
        };
      });

      // Filter out frames with no tagged elements
      const exportableFrames = frameExports.filter(f => f.taggedElements.length > 0);

      if (exportableFrames.length === 0) {
        addToast({
          type: 'warning',
          title: 'No elements to export',
          message: 'Add semantic tags (Button, Input, Section) to elements first.',
        });
        setIsExporting(false);
        return;
      }

      const exportData: ExportData = {
        version: '3.0.0',  // Bump version for component support
        exportedAt: new Date().toISOString(),
        frames: exportableFrames,
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wireflow-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success message
      const totalElements = exportableFrames.reduce((sum, f) => sum + f.taggedElements.length, 0);
      addToast({
        type: 'success',
        title: 'Export successful',
        message: `Exported ${exportableFrames.length} frame(s) with ${totalElements} tagged element(s)`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      addToast({
        type: 'error',
        title: 'Export failed',
        message: 'Please try again or check the browser console for details.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Count tagged elements across all frames
  const totalTagged = frames.reduce((sum, frame) =>
    sum + frame.elements.filter(el => el.semanticTag).length, 0
  );

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all duration-150 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]"
      disabled={totalTagged === 0 || isExporting}
      aria-busy={isExporting}
    >
      {isExporting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      <span>{isExporting ? 'Exporting...' : 'Export JSON'}</span>
      {totalTagged > 0 && !isExporting && (
        <span className="bg-zinc-700 dark:bg-zinc-300 px-2 py-0.5 rounded text-xs">
          {totalTagged}
        </span>
      )}
    </button>
  );
}

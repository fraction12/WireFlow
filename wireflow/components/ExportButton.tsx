'use client';

import type { Frame, ExportData, ExportedElement, TextElement, FrameExport } from '@/lib/types';

interface ExportButtonProps {
  frames: Frame[];
}

export function ExportButton({ frames }: ExportButtonProps) {
  const handleExport = () => {
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
      alert('No tagged elements to export across any frames. Add semantic tags (Button, Input, Section) to elements first.');
      return;
    }

    const exportData: ExportData = {
      version: '3.0.0',  // Bump version for component support
      exportedAt: new Date().toISOString(),
      frames: exportableFrames,
    };

    // Create and download JSON file with error handling
    try {
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
      alert(`Exported ${exportableFrames.length} frame(s) with ${totalElements} tagged element(s)`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export JSON file. Please try again or check the browser console for details.');
    }
  };

  // Count tagged elements across all frames
  const totalTagged = frames.reduce((sum, frame) =>
    sum + frame.elements.filter(el => el.semanticTag).length, 0
  );

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded hover:bg-zinc-800 transition-colors flex items-center gap-2"
      disabled={totalTagged === 0}
    >
      <span>Export JSON</span>
      {totalTagged > 0 && (
        <span className="bg-zinc-700 px-2 py-0.5 rounded text-xs">
          {totalTagged}
        </span>
      )}
    </button>
  );
}

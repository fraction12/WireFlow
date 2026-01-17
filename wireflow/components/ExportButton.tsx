'use client';

import type { CanvasElement, ExportData, ExportedElement, TextElement } from '@/lib/types';

interface ExportButtonProps {
  elements: CanvasElement[];
}

export function ExportButton({ elements }: ExportButtonProps) {
  const handleExport = () => {
    // Filter only tagged elements
    const taggedElements = elements.filter(el => el.semanticTag);

    if (taggedElements.length === 0) {
      alert('No tagged elements to export. Add semantic tags (Button, Input, Section) to elements first.');
      return;
    }

    // Transform to export format
    const exportedElements: ExportedElement[] = taggedElements.map(el => ({
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
    }));

    const exportData: ExportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      taggedElements: exportedElements,
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
    alert(`Exported ${exportedElements.length} tagged element${exportedElements.length !== 1 ? 's' : ''}`);
  };

  const taggedCount = elements.filter(el => el.semanticTag).length;

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded hover:bg-zinc-800 transition-colors flex items-center gap-2"
      disabled={taggedCount === 0}
    >
      <span>Export JSON</span>
      {taggedCount > 0 && (
        <span className="bg-zinc-700 px-2 py-0.5 rounded text-xs">
          {taggedCount}
        </span>
      )}
    </button>
  );
}

---
active: true
iteration: 1
max_iterations: 50
completion_promise: "CANVAS TOOLS PRODUCTION READY"
started_at: "2026-01-18T04:38:49Z"
---

Iterate on WireFlow canvas tools until they match Excalidraw's production quality.

ASSESS against Excalidraw features:
- Selection (single, multi, box select, shift-click)
- Shapes (rectangle, ellipse, diamond, line, arrow, freehand)
- Text with inline editing
- Connectors that snap and stay attached
- Resize handles with shift for aspect ratio
- Rotation with snapping
- Copy/paste/duplicate, Undo/redo
- Zoom/pan, Layers, Snap-to-grid, Alignment guides
- Export (PNG, SVG), Keyboard shortcuts

EACH ITERATION:
1. Identify the most impactful missing/broken feature
2. Implement it with 60fps interactions, proper hit detection, undo support
3. Test manually in the running app
4. Commit the working feature
5. Move to next feature

Priority: Selection → Shapes → Text → Connectors → Transforms → Polish

When ALL core features work smoothly with no obvious bugs, output:
<promise>CANVAS TOOLS PRODUCTION READY</promise>

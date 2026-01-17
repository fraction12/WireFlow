# CLAUDE_README - AI Coding Agent Instructions for WireFlow

This document provides instructions for AI coding agents working on the WireFlow codebase.

## Project Overview

WireFlow is a **PM-centric wireframing tool** for rapid, freeform product sketching with optional semantic structure. It follows a **two-layer architecture**:

1. **Visual Layer** - Freeform canvas drawing (always present)
2. **Semantic Layer** - Tags + annotations (optional, added after sketching)

Only semantically tagged elements are exported to JSON for engineering handoff.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.3 | App Router framework |
| React | 19.2.3 | UI components |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| pnpm | - | Package manager |

## Project Structure

```
wireflow/
├── app/
│   ├── page.tsx           # Entry point - renders Canvas
│   ├── layout.tsx         # Root layout with metadata
│   └── globals.css        # Tailwind + global styles
│
├── components/
│   ├── Canvas.tsx         # Core component (~1000 lines) - owns ALL state
│   ├── Toolbar.tsx        # Tool selector sidebar
│   ├── SidePanel.tsx      # Semantic tagging editor
│   ├── ExportButton.tsx   # JSON export functionality
│   ├── FrameList.tsx      # Frame/page management
│   └── ComponentPanel.tsx # Pre-built component templates
│
├── lib/
│   ├── types.ts           # All type definitions (single source of truth)
│   └── componentTemplates.ts # Predefined UI component templates
│
└── Documentation
    ├── ARCHITECTURE.md    # Design philosophy & architecture
    ├── IMPLEMENTATION.md  # Implementation details
    └── USAGE.md           # User guide
```

## Key Files to Understand

### `/lib/types.ts` - Type Definitions
All types are defined here. Key types:

```typescript
// Visual element types
type ElementType = 'rectangle' | 'text' | 'arrow'

// Semantic tags for PM layer
type SemanticTag = 'button' | 'input' | 'section' | null

// Drawing tools
type Tool = 'select' | 'rectangle' | 'text' | 'arrow'
          | 'section' | 'divider' | 'button' | 'input'
          | 'checkbox' | 'callout' | 'badge'

// Frame types
type FrameType = 'page' | 'modal' | 'flyout'

// Element union type (discriminated union)
type CanvasElement = RectangleElement | TextElement | ArrowElement
```

### `/components/Canvas.tsx` - The Core Component
This is the **most important file**. It owns all state and orchestrates the entire app.

**State it manages:**
- `frames[]` - All frames/pages
- `activeFrameId` - Currently active frame
- `elements[]` - Elements in active frame
- `currentTool` - Active drawing tool
- `selectedElementId` - Currently selected element
- `componentGroups[]` - Grouped component elements
- Drawing state: `isDrawing`, `startPoint`, `dragOffset`, `resizeHandle`

**Key methods:**
- `redraw()` - Redraws all elements on state change
- `drawSketchLine()` - Creates hand-drawn sketch appearance
- `findElementAtPoint()` - Hit detection for selection
- `handleMouseDown/Move/Up()` - All interaction handlers
- `createComponentGroup()` - Template instantiation

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Coding Conventions

### General Rules

1. **Make small, incremental changes** - Don't refactor unrelated code
2. **Do not introduce new libraries** unless explicitly requested
3. **Prefer editing existing files** over creating new ones
4. **Add comments** to explain non-obvious code
5. **Use `'use client'`** directive for interactive components

### TypeScript Conventions

- Define new types in `/lib/types.ts`
- Use discriminated unions for element variants
- Always type function parameters and return values
- Use interfaces for object shapes, types for unions

```typescript
// Good - type in types.ts
export type NewFeature = 'option1' | 'option2';

// Good - interface with optional semantic properties
interface NewElement extends BaseElement {
  type: 'new-element';
  customProp: string;
  semanticTag?: SemanticTag; // Optional semantic layer
}
```

### React Patterns

- **Lift State Up**: Canvas owns all state, children are controlled
- **No global state management**: No Redux, Zustand, or Context
- **Props-only children**: Toolbar, SidePanel, etc. receive props from Canvas
- **Callbacks for updates**: Children emit changes via callback props

```typescript
// Pattern: Controlled component
<SidePanel
  element={selectedElement}
  onUpdateElement={(updated) => {
    setElements(elements.map(el =>
      el.id === updated.id ? updated : el
    ))
  }}
/>
```

### Styling Conventions

- Use Tailwind CSS utility classes
- Common colors in the app:
  - `#6b7280` (gray) - Untagged elements
  - `#3b82f6` (blue) - Selected elements
  - `#10b981` (green) - Semantically tagged elements
  - `#8b5cf6` (purple) - Grouped components
- Use `zinc` scale for UI chrome (borders, backgrounds)

### File Organization

- One component per file
- Component files use PascalCase: `NewComponent.tsx`
- Shared types go in `lib/types.ts`
- Template data goes in `lib/componentTemplates.ts`

## Design Principles to Maintain

### 1. Two-Layer Architecture
Keep the visual and semantic layers separate:
- Elements start as pure visual objects
- Semantic tags are added optionally
- Export only includes tagged elements

### 2. Sketch-First Philosophy
- No grids, snapping, or alignment tools
- Rough, hand-drawn aesthetic (deterministic wobble)
- Speed over precision

### 3. Intentional Constraints
These are **features, not bugs**:
- No undo/redo (encourages rough sketching)
- No persistence (export is the only output)
- No styling controls (prevents premature design)
- No zoom/pan (fixed 2000×2000 canvas)

### 4. Progressive Disclosure
- Show complexity only when needed
- Annotation fields appear only for tagged elements
- Component details expand only when selected

## How to Add New Features

### Adding a New Tool

1. **Add tool type** in `lib/types.ts`:
   ```typescript
   export type Tool = 'select' | 'rectangle' | ... | 'new-tool';
   ```

2. **Add to Toolbar** in `components/Toolbar.tsx`:
   ```typescript
   const tools = [
     // existing tools...
     { name: 'new-tool', label: 'New Tool', icon: '✦', category: 'Category' },
   ];
   ```

3. **Handle in Canvas** in `components/Canvas.tsx`:
   - Add case in `handleMouseDown/Move/Up` for the new tool behavior
   - Add rendering logic in `redraw()` if needed

### Adding a New Element Type

1. **Define type** in `lib/types.ts`:
   ```typescript
   export interface NewElement extends BaseElement {
     type: 'new-element';
     customProperty: string;
   }

   export type CanvasElement = RectangleElement | TextElement | ArrowElement | NewElement;
   export type ElementType = 'rectangle' | 'text' | 'arrow' | 'new-element';
   ```

2. **Add rendering** in `Canvas.tsx` `redraw()`:
   ```typescript
   if (element.type === 'new-element') {
     // Draw the element
   }
   ```

3. **Update export** in `ExportButton.tsx` if it should be exportable

### Adding a New Semantic Tag

1. **Add to SemanticTag** in `lib/types.ts`:
   ```typescript
   export type SemanticTag = 'button' | 'input' | 'section' | 'new-tag' | null;
   ```

2. **Update SidePanel** to display the new tag option

### Adding a Component Template

1. **Add template** in `lib/componentTemplates.ts`:
   ```typescript
   export const componentTemplates: ComponentTemplate[] = [
     // existing templates...
     {
       id: 'new-component',
       type: 'new-component' as ComponentType,
       name: 'New Component',
       description: 'Description here',
       width: 300,
       height: 200,
       elements: [
         // Define child elements with offsets
       ],
     },
   ];
   ```

2. **Add type** in `lib/types.ts`:
   ```typescript
   export type ComponentType = ... | 'new-component';
   ```

## Common Patterns

### Element Creation Pattern
```typescript
const newElement: RectangleElement = {
  id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type: 'rectangle',
  x: startX,
  y: startY,
  width: currentX - startX,
  height: currentY - startY,
};
setElements([...elements, newElement]);
```

### Element Update Pattern
```typescript
setElements(elements.map(el =>
  el.id === targetId ? { ...el, ...updates } : el
));
```

### Hit Detection Pattern
```typescript
const findElementAtPoint = (x: number, y: number): CanvasElement | null => {
  // Check in reverse order (top-most first)
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (x >= el.x && x <= el.x + el.width &&
        y >= el.y && y <= el.y + el.height) {
      return el;
    }
  }
  return null;
};
```

## What NOT to Do

1. **Don't add global state management** - Keep state in Canvas
2. **Don't add complex animations** - Contradicts sketch aesthetic
3. **Don't add many styling options** - Prevents premature design
4. **Don't create unnecessary new files** - Prefer editing Canvas.tsx
5. **Don't remove intentional limitations** - They're design features
6. **Don't add grids/snapping** - Contradicts freeform philosophy
7. **Don't add external dependencies** without explicit request

## Testing Changes

Since there are no automated tests:
1. Run `pnpm dev` and test manually
2. Test all tools work correctly
3. Test element selection, move, resize
4. Test semantic tagging flow
5. Test export produces valid JSON
6. Run `pnpm lint` before committing
7. Run `pnpm build` to ensure no build errors

## Performance Considerations

- Canvas redraws all elements on every state change
- Acceptable for < 100 elements at 60fps
- If performance becomes an issue:
  - Consider canvas layering (static vs dynamic)
  - Implement spatial indexing for hit detection
  - Batch state updates

## Git Workflow

```bash
# Make changes
git status
git add .
git commit -m "descriptive message"
git push -u origin branch-name
```

## Questions to Ask Before Making Changes

1. Does this maintain the two-layer architecture?
2. Does this preserve the sketch-first philosophy?
3. Is this the simplest solution?
4. Can I modify an existing file instead of creating a new one?
5. Have I added types to `lib/types.ts`?
6. Does this work with the existing state management pattern?

## Summary

WireFlow prioritizes:
- **Speed** over precision
- **Exploration** over structure
- **Simplicity** over features
- **Constraint** over configurability

When building features, maintain these principles. The tool succeeds by staying simple and focused on its core purpose: fast PM wireframing with structured export.

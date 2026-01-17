# WireFlow Implementation Guide

## Overview

WireFlow is a freeform sketch-based wireframing tool designed specifically for early product thinking. It prioritizes speed and roughness over precision, with optional semantic structure added after sketching.

## Architecture & Design Decisions

### Core Philosophy: Sketch First, Structure Later

The tool is built on the principle that **drawing should feel completely unstructured**. Structure (semantic tagging) is an optional layer added after sketching, not during.

```
Visual Layer (Always present)
    ↓
Semantic Layer (Optional, additive)
    ↓
Export (Only structured elements)
```

### What Was Intentionally Excluded

1. **No Grids or Snapping**
   - Grids create visual anchors that encourage precision
   - Early wireframes should be rough, not pixel-perfect
   - Omitted to preserve the freeform sketching feel

2. **No Auto-layout or Alignment Tools**
   - Auto-layout implies hierarchical structure
   - PMs think in flows and concepts, not layouts
   - Structure emerges from thinking, not from tools

3. **No Visual Styling Controls**
   - No colors, fonts, borders, shadows
   - Prevents premature focus on aesthetics
   - All elements use the same stroke style (rough sketch aesthetic)

4. **No Component Libraries or Templates**
   - Every wireframe starts from scratch
   - Forces thinking rather than assembling
   - Templates constrain early-stage exploration

5. **Limited Tool Set**
   - Only Rectangle, Text, Arrow, and Select
   - Intentionally minimal to reduce cognitive load
   - More tools = more decisions = slower thinking

## Implementation Details

### File Structure

```
wireflow/
├── lib/
│   └── types.ts              # Core type definitions
├── components/
│   ├── Canvas.tsx            # Main canvas with drawing logic
│   ├── Toolbar.tsx           # Tool selection sidebar
│   ├── SidePanel.tsx         # Semantic tagging panel
│   └── ExportButton.tsx      # JSON export functionality
└── app/
    └── page.tsx              # Entry point
```

### Core Types (`lib/types.ts`)

```typescript
// Visual elements (always present)
ElementType = 'rectangle' | 'text' | 'arrow'

// Semantic tags (optional layer)
SemanticTag = 'button' | 'input' | 'section' | null

// Base element with optional PM annotations
interface BaseElement {
  id: string
  type: ElementType
  x, y, width, height: number

  // PM Layer (optional)
  semanticTag?: SemanticTag
  description?: string
  intendedBehavior?: string
  acceptanceNotes?: string
}
```

### How Semantic Tagging Works

#### 1. Drawing Phase (No Structure)
- User draws rectangles, text, arrows freely
- All elements exist as pure visual objects
- No semantic meaning attached
- Canvas feels like sketching on paper

#### 2. Tagging Phase (Adding Structure)
- Select any rectangle or text element
- Side panel appears with tagging options
- Add semantic tag: Button, Input, or Section
- Tagged elements turn green to indicate structure

#### 3. Annotation Phase (PM Thinking)
When an element is tagged, the side panel expands to show:
- **Description**: What is this element?
- **Intended Behavior**: What should happen when interacted with?
- **Acceptance Notes**: How will we verify this works?

These fields capture PM thinking and become part of the export.

#### 4. Export Phase (Structure Only)
- Only tagged elements are exported
- Pure visual sketches (untagged) are ignored
- Export includes position, size, type, and all annotations
- Output is structured JSON ready for handoff

### Canvas Implementation (`components/Canvas.tsx`)

The canvas uses native HTML5 Canvas API for maximum performance and drawing flexibility.

#### Drawing Logic
```typescript
// All elements stored as data
const [elements, setElements] = useState<CanvasElement[]>([])

// Re-render on every change
useEffect(() => {
  redraw() // Redraws all elements
}, [elements, selectedElementId])
```

#### Tool Behaviors

**Rectangle Tool:**
- Click and drag to create
- Minimum size enforced (5px) to prevent accidental dots
- Width/height calculated from start and end points

**Text Tool:**
- Click to place text element immediately
- Opens side panel for editing content
- Default "Text" placeholder content

**Arrow Tool:**
- Click and drag for direction
- Arrowhead drawn at endpoint
- Useful for flow indication

**Select Tool:**
- Click to select elements
- Drag to move elements
- Corner handles for resizing (rectangles and text only)
- Arrows can be moved but not resized

#### Visual Feedback

```typescript
// Color coding for state
Default elements:    #374151 (gray)
Selected elements:   #3b82f6 (blue)
Tagged elements:     #10b981 (green)
```

This creates a visual hierarchy:
- Gray = sketch
- Blue = selected
- Green = structured (ready for export)

### Side Panel (`components/SidePanel.tsx`)

The side panel implements a progressive disclosure pattern:

```
1. Always visible:
   - Element type (rectangle, text, arrow)
   - Text content (for text elements)
   - Semantic tag selector

2. Visible only when tagged:
   - Description field
   - Intended behavior field
   - Acceptance notes field

3. Not visible for untagged:
   - Helpful hint explaining tagging
```

This prevents overwhelming users with fields they don't need until they're ready to add structure.

### Export Format (`components/ExportButton.tsx`)

#### Export Logic
```typescript
1. Filter: Only elements with semanticTag !== null
2. Transform: Convert canvas data to export format
3. Download: Generate JSON file
```

#### Export JSON Structure
```json
{
  "version": "1.0.0",
  "exportedAt": "2026-01-16T...",
  "taggedElements": [
    {
      "id": "el_1234_abc",
      "type": "rectangle",
      "position": { "x": 100, "y": 150 },
      "size": { "width": 200, "height": 50 },
      "semanticTag": "button",
      "annotations": {
        "description": "Primary CTA button",
        "intendedBehavior": "Submits form and navigates to confirmation",
        "acceptanceNotes": "Should validate all required fields first"
      }
    }
  ]
}
```

### Why This Structure?

1. **Separation of Concerns**
   - Visual layer (canvas drawing) independent of semantic layer
   - Can sketch without thinking about structure
   - Structure doesn't interfere with drawing

2. **PM-Centric Workflow**
   - Annotations match PM thinking patterns
   - Description = "What is it?"
   - Behavior = "What does it do?"
   - Acceptance = "How do we know it works?"

3. **Clean Handoff**
   - Only structured elements exported
   - No noise from exploratory sketches
   - Ready for engineering consumption

## Usage Flow

### Typical Session

1. **Rapid Sketching** (2-5 minutes)
   - Draw boxes for major sections
   - Add text labels
   - Draw arrows for flow

2. **Review and Tag** (3-7 minutes)
   - Select important elements
   - Add semantic tags
   - Ignore exploratory/throwaway sketches

3. **Annotate** (5-10 minutes)
   - Add descriptions for context
   - Specify behaviors for interactions
   - Write acceptance criteria

4. **Export** (instant)
   - Click "Export JSON"
   - Only tagged elements exported
   - Share with engineering team

### Example Scenario

**PM sketching a login flow:**

1. Draws 3 rectangles (email, password, button)
2. Adds text labels
3. Draws arrow to "forgot password"
4. Draws arrow to "success screen" (separate sketch)
5. Tags email + password as "input"
6. Tags login button as "button"
7. Adds behavior: "Validates, authenticates, redirects"
8. Leaves forgot password sketch untagged (just exploration)
9. Exports: Only 3 elements (2 inputs, 1 button) with annotations

**Result:** Clean structured export without cluttering with exploratory sketches.

## Technical Considerations

### Performance

- Canvas renders all elements on every redraw
- For typical wireframes (< 100 elements), performance is excellent
- If scaling needed, could implement:
  - Canvas layering (static vs dynamic)
  - Dirty rectangle optimization
  - Virtual scrolling for large canvases

### Browser Compatibility

- Uses standard Canvas API (universal support)
- No dependencies on experimental APIs
- Works in all modern browsers

### State Management

- Simple React useState for element storage
- No external state library needed
- State is ephemeral (no persistence yet)

### Future Enhancements (Not Implemented)

**Explicitly omitted to maintain simplicity:**
- Undo/redo
- Save/load functionality
- Multi-page wireframes
- Collaboration features
- More semantic tags
- Custom tag types

## Key Design Insights

### Why Semantic Tagging Works

1. **Additive, not prescriptive**
   - Doesn't force structure during sketching
   - Applied when thinking crystallizes

2. **Selective export**
   - Throwaway sketches stay on canvas
   - Only intentional structure exported

3. **PM vocabulary**
   - Tags match how PMs think
   - Not developer-centric (div, span, etc.)
   - Not designer-centric (frame, group, etc.)

### Why Limited Tools Work

- Fewer choices = faster decisions
- Rectangle is universal (button, input, section, card, etc.)
- Text is sufficient for labels
- Arrows show flow
- Anything more complex should be in a different tool

### Why No Styling Works

- Prevents bikeshedding on colors/fonts
- Keeps focus on structure and behavior
- Forces "content-first" thinking
- Design comes later, after structure is validated

## Comparison to Excalidraw

**What we kept:**
- Rough, sketchy aesthetic
- Minimal UI
- Fast, unstructured drawing

**What we changed:**
- No styling options (Excalidraw has many)
- Semantic tagging layer (Excalidraw is pure visual)
- PM-specific annotations (Excalidraw is general-purpose)
- Selective export (Excalidraw exports everything)

**Result:** A tool specifically for PM wireframing, not general diagramming.

## Running the Application

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Production build
pnpm build
pnpm start
```

## Conclusion

WireFlow demonstrates how **constraint breeds clarity**. By intentionally limiting tools and postponing structure, it creates space for fast, freeform product thinking. The semantic layer provides just enough structure for engineering handoff without constraining early exploration.

The tool succeeds because it respects the PM workflow: think fast, sketch rough, structure later.

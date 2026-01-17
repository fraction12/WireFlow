# WireFlow Architecture

## Design Philosophy

### Core Principle: Layered Semantics

WireFlow implements a **two-layer architecture** that separates visual representation from semantic meaning:

```
┌─────────────────────────────────────┐
│     Visual Layer (Canvas)           │  ← Always present
│  - Freeform drawing                 │  ← No constraints
│  - Rough sketches                   │  ← Fast iteration
│  - Exploratory work                 │  ← Throwaway OK
└─────────────────────────────────────┘
              ↓ (optional)
┌─────────────────────────────────────┐
│   Semantic Layer (Tags + Annotations)│ ← Added selectively
│  - Button / Input / Section         │  ← PM vocabulary
│  - Description                       │  ← What is it?
│  - Intended Behavior                 │  ← What does it do?
│  - Acceptance Notes                  │  ← How to verify?
└─────────────────────────────────────┘
              ↓ (export)
┌─────────────────────────────────────┐
│      Structured Output (JSON)       │  ← Only tagged elements
│  - Ready for engineering            │  ← Clean handoff
│  - Position + Size + Annotations    │  ← Implementation-ready
└─────────────────────────────────────┘
```

### Why This Works

1. **Separation allows speed** - Drawing isn't slowed by structure
2. **Structure is additive** - No forced taxonomy during sketching
3. **Export is selective** - Only intentional work leaves the canvas
4. **Thinking is preserved** - Visual exploration remains visible

## Component Architecture

### File Organization

```
wireflow/
├── lib/
│   └── types.ts              # Type definitions (single source of truth)
│
├── components/
│   ├── Canvas.tsx            # Canvas orchestrator (600+ lines)
│   │   ├── Drawing logic
│   │   ├── Tool handling
│   │   ├── Selection system
│   │   └── Resize/move logic
│   │
│   ├── Toolbar.tsx           # Tool selector (50 lines)
│   │   └── Simple button grid
│   │
│   ├── SidePanel.tsx         # Semantic editor (150 lines)
│   │   ├── Tag selector
│   │   └── Annotation fields
│   │
│   └── ExportButton.tsx      # Export logic (70 lines)
│       ├── Filter tagged elements
│       ├── Transform to export format
│       └── Download JSON
│
└── app/
    ├── page.tsx              # Entry point (3 lines)
    └── layout.tsx            # HTML wrapper
```

### Component Responsibilities

#### Canvas.tsx - The Core
**Responsibilities:**
- Element storage (`useState<CanvasElement[]>`)
- Tool state management
- Mouse event handling
- Drawing/rendering via Canvas API
- Selection tracking
- Move/resize logic
- Element hit detection

**Why it's complex:**
Canvas is the "smart" component - it owns all state and behavior. This centralization makes reasoning about the app straightforward despite the complexity.

**Key design decisions:**
- **Redraw on every state change** - Simple mental model
- **Array-based storage** - Easy to reason about
- **ID-based selection** - Stable references during moves/resizes

#### Toolbar.tsx - Pure UI
**Responsibilities:**
- Display tool options
- Highlight active tool
- Emit tool change events

**Why it's simple:**
Pure presentation component with no state. Receives current tool and change handler from parent.

#### SidePanel.tsx - Semantic Editor
**Responsibilities:**
- Display element properties
- Semantic tag selection
- Annotation field editing
- Emit element updates

**Key design decisions:**
- **Local state + immediate updates** - Feels responsive
- **Conditional rendering** - Annotations only visible when tagged
- **Progressive disclosure** - Complexity appears only when needed

#### ExportButton.tsx - Data Transform
**Responsibilities:**
- Filter tagged elements
- Transform to export schema
- Generate JSON file
- Trigger download

**Why it's separate:**
Export is conceptually distinct from editing. Separate component keeps concerns clean.

## Data Flow

### State Management Pattern

```typescript
// Parent (Canvas) owns all state
const [elements, setElements] = useState<CanvasElement[]>([])
const [selectedId, setSelectedId] = useState<string | null>(null)
const [currentTool, setCurrentTool] = useState<Tool>('select')

// Children receive state + callbacks
<Toolbar
  currentTool={currentTool}
  onToolChange={setCurrentTool}
/>

<SidePanel
  element={selectedElement}
  onUpdateElement={(updated) => {
    setElements(elements.map(el =>
      el.id === updated.id ? updated : el
    ))
  }}
/>
```

**Pattern: Lift State Up**
- Single source of truth (Canvas)
- Children are controlled components
- Updates flow through callbacks
- Simple, predictable data flow

### Why No Global State?

We don't use Redux, Context, or other state management because:
1. **Single component owns state** - No need to share across tree
2. **Prop drilling is minimal** - Only 1-2 levels deep
3. **No complex derived state** - Render directly from elements array
4. **Simpler to understand** - Fewer concepts, less indirection

## Drawing System

### Canvas API Choice

We use native HTML5 Canvas instead of SVG because:

**Performance:**
- Canvas: O(1) drawing (redraw everything)
- SVG: O(n) DOM manipulation

**Simplicity:**
- Canvas: Imperative drawing code
- SVG: Declarative element management

**Control:**
- Canvas: Direct pixel control
- SVG: Browser-managed rendering

For wireframing (< 100 elements, frequent redraws), Canvas is faster and simpler.

### Rendering Loop

```typescript
// Redraw on every state change
useEffect(() => {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, width, height)  // Clear

  elements.forEach(element => {
    // Draw element based on type
    if (element.type === 'rectangle') {
      ctx.strokeRect(x, y, w, h)
    }
    // ... other types

    // Draw selection indicators
    if (element.id === selectedId) {
      drawHandles(element)
    }
  })
}, [elements, selectedId])
```

**Why this works:**
- Modern browsers are fast enough to redraw 100 elements at 60fps
- Simpler than dirty rectangle tracking
- No state synchronization issues
- Easy to understand and debug

## Interaction System

### Tool State Machine

```
SELECT: Click → Select element → Enable move/resize
        Click empty → Deselect

RECTANGLE: MouseDown → Record start point
           MouseMove → Show preview
           MouseUp → Create element

TEXT: Click → Create element immediately

ARROW: MouseDown → Record start point
       MouseMove → Show preview
       MouseUp → Create element
```

### Event Handling Pattern

```typescript
const handleMouseDown = (e) => {
  const {x, y} = getMousePosition(e)

  if (currentTool === 'select') {
    const element = findElementAtPoint(x, y)
    if (element) {
      setSelectedId(element.id)
      // Check for resize handle or start drag
    }
  } else {
    // Start drawing new element
    setStartPoint({x, y})
  }
}

const handleMouseMove = (e) => {
  if (!isDrawing) return
  // Update element position or show preview
}

const handleMouseUp = (e) => {
  // Finalize element creation or move
  setIsDrawing(false)
}
```

**Pattern: Mode-based handling**
- Tool determines handler behavior
- State flags track interaction phase
- Clean separation of concerns

## Type System

### Core Types

```typescript
// Discriminated union for type safety
type CanvasElement =
  | RectangleElement
  | TextElement
  | ArrowElement

// Each variant shares BaseElement properties
interface BaseElement {
  id: string
  type: ElementType
  x, y, width, height: number
  // Optional semantic layer
  semanticTag?: SemanticTag
  description?: string
  intendedBehavior?: string
  acceptanceNotes?: string
}
```

### Why This Type Design?

**Discriminated unions provide:**
- Type narrowing based on `type` field
- Exhaustive case checking
- Shared property access
- Type-specific property access

**Example:**
```typescript
function renderElement(el: CanvasElement) {
  // Shared properties always available
  console.log(el.x, el.y)

  // Type narrowing
  if (el.type === 'text') {
    console.log(el.content) // TypeScript knows this exists
  }
}
```

### Optional Semantic Layer

```typescript
// Semantic properties are optional
semanticTag?: 'button' | 'input' | 'section' | null
description?: string
intendedBehavior?: string
acceptanceNotes?: string
```

**Why optional?**
- Elements start as pure visual objects
- Semantic layer added later
- Type system enforces this gradual structure
- Export filters by presence of `semanticTag`

## Export System

### Transformation Pipeline

```
Elements Array
    ↓ Filter
Tagged Elements Only
    ↓ Transform
Export Format
    ↓ Serialize
JSON String
    ↓ Download
File on Disk
```

### Export Format Design

```typescript
interface ExportedElement {
  id: string                    // Stable reference
  type: ElementType             // Implementation hint
  position: {x: number, y: number}  // Absolute position
  size: {width: number, height: number}  // Dimensions
  semanticTag: SemanticTag      // Required (filtered)
  annotations: {                // PM thinking
    description?: string
    intendedBehavior?: string
    acceptanceNotes?: string
  }
  content?: string             // For text elements
}
```

**Design choices:**
- **Flat structure** - Easy to parse
- **No canvas-specific data** - Position is absolute, not relative
- **Self-contained** - Each element independent
- **Annotations grouped** - Semantic layer explicit

### Why JSON Export?

**Advantages:**
- Universal format
- Human-readable
- Easy to parse in any language
- Can be diffed in version control
- Compatible with API contracts

**Alternatives considered:**
- **Markdown** - Too informal, loses structure
- **YAML** - More readable but less universal
- **Binary** - Faster but not inspectable
- **API POST** - Requires backend, adds complexity

## Intentional Limitations

### What's Missing (By Design)

1. **Undo/Redo**
   - Adds significant complexity (action history, state snapshots)
   - Encourages perfectionism (contradicts "rough sketch" philosophy)
   - Can be worked around (just redraw quickly)

2. **Persistence**
   - No save/load functionality
   - Sessions are ephemeral
   - Export is the only output
   - Reason: Forces focus on export-ready structure

3. **Multi-page / Artboards**
   - Single canvas only
   - Reason: Keeps mental model simple
   - Workaround: Use spatial separation on large canvas

4. **Zoom / Pan**
   - Fixed viewport
   - Reason: Simplicity, less state management
   - Canvas is large (2000x2000) to accommodate big wireframes

5. **Collaboration**
   - Single-user only
   - Reason: Avoids complexity of real-time sync
   - Export can be shared asynchronously

6. **Styling Controls**
   - No colors, fonts, borders, shadows
   - Reason: Prevents premature design decisions
   - All elements use same rough aesthetic

### Why These Limitations Matter

Each limitation is a **deliberate constraint** that:
- Reduces cognitive load
- Prevents feature creep
- Maintains focus on core workflow
- Preserves "rough sketch" feel

The tool succeeds by **staying simple**.

## Performance Characteristics

### Time Complexity

```
Rendering: O(n) where n = number of elements
Hit detection: O(n) with early exit
Selection: O(1) lookup by ID
Export: O(n) where n = tagged elements
```

### Space Complexity

```
Element storage: O(n) where n = number of elements
Canvas memory: O(1) (fixed 2000x2000)
Export output: O(k) where k = tagged elements
```

### Practical Limits

**Tested scenarios:**
- 100 elements: Smooth (60fps)
- 500 elements: Slightly laggy
- 1000+ elements: Not recommended

**Why this is acceptable:**
Wireframes with 100+ elements indicate the wrong tool is being used. Complex wireframes should be broken into multiple sessions or use different tooling.

## Testing Strategy

### What Would Be Tested

**Unit tests:**
- Type transformations (element → export format)
- Hit detection algorithms
- Resize calculations

**Integration tests:**
- Tool switching
- Element creation flow
- Tagging workflow

**E2E tests:**
- Complete wireframing session
- Export validation

### Current State

No tests implemented yet. For a prototype/MVP, manual testing is sufficient. Tests would be added when:
- Collaboration features added (complex state)
- Export format becomes API contract
- Tool is used in production

## Scalability Considerations

### Current Limitations

1. **No backend** - All state in browser memory
2. **No persistence** - Refresh loses work
3. **No collaboration** - Single user only
4. **No version history** - No audit trail

### How to Scale (If Needed)

**For persistence:**
```typescript
// Save to localStorage after each change
useEffect(() => {
  localStorage.setItem('wireflow-state',
    JSON.stringify(elements))
}, [elements])
```

**For collaboration:**
```typescript
// Operational Transform or CRDT
// Sync element array through WebSocket
// Conflict resolution for concurrent edits
```

**For performance:**
```typescript
// Canvas layering
// Spatial indexing (quadtree) for hit detection
// Virtual canvas rendering
// WebWorker for export processing
```

## Deployment

### Build Output

```
next build
  ↓
.next/
├── static/           # Static assets
└── server/           # Server components
```

### Hosting Options

**Vercel** (recommended):
- Zero config deployment
- Automatic HTTPS
- Global CDN
- Preview deployments

**Self-hosted:**
- `next build && next start`
- Requires Node.js runtime
- Can be containerized

**Static export:**
- `next export` (if no server features used)
- Can be hosted on any static host

## Future Architecture Considerations

### If the tool evolves...

**Persistence:**
```
Elements Array → IndexedDB → Cross-session state
               → Backend API → Multi-device sync
```

**Collaboration:**
```
Elements Array → CRDT → Conflict-free merging
               → WebSocket → Real-time updates
```

**Templates:**
```
Elements Array → Template Library → Reusable patterns
               → Component System → Semantic components
```

**But remember:** Each addition adds complexity. Constraint breeds clarity.

## Conclusion

WireFlow's architecture is intentionally simple:
- **Two layers**: Visual + Semantic
- **One owner**: Canvas component
- **One output**: Tagged elements as JSON
- **One canvas**: No multi-page complexity

This simplicity is the architecture's greatest strength. It makes the codebase easy to understand, easy to modify, and easy to reason about.

The tool does one thing well: **fast PM wireframing with structured export**.

Everything else is deliberately excluded.

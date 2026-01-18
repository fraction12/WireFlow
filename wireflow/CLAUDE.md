# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint check
```

No test framework is configured - test manually in browser.

## Architecture Overview

WireFlow is a PM-centric wireframing tool with a **two-layer architecture**:

1. **Visual Layer** - Freeform canvas drawing (always present)
2. **Semantic Layer** - Optional tags + annotations added after sketching

Only semantically tagged elements are exported to JSON for engineering handoff.

### State Management

**Canvas.tsx (~2000 lines) owns ALL state** - no Redux, Context, or global state. Children receive props and emit changes via callbacks.

Key state:
- `frames[]`, `activeFrameId` - Multi-page support
- `elements[]` - Elements in active frame
- `currentTool`, `selectedElementId` - Interaction state
- `componentGroups`, `userComponents` - Component system

### Key Files

| File | Purpose |
|------|---------|
| `lib/types.ts` | All type definitions (single source of truth) |
| `components/Canvas.tsx` | Core component - state, drawing, interaction |
| `lib/componentTemplates.ts` | Built-in component templates |
| `lib/persistence.ts` | localStorage save/load |
| `lib/colors.ts` | Color palette and utilities |

### Type System

Uses discriminated unions for type safety:
```typescript
type CanvasElement = RectangleElement | EllipseElement | DiamondElement | TextElement | ArrowElement | LineElement | FreedrawElement
```

All types defined in `lib/types.ts`. New types MUST go there.

## Design Principles

### Intentional Constraints (Features, Not Bugs)
- No grids/snapping - freeform philosophy
- Fixed 2000x2000 canvas - no zoom/pan
- Rough sketch aesthetic - deterministic wobble
- Semantic layer is additive, not prescriptive

### What NOT to Do
- Don't add global state management
- Don't create unnecessary new files (prefer editing Canvas.tsx)
- Don't remove intentional limitations
- Don't add external dependencies without explicit request

## Adding Features

**New Tool:**
1. Add type to `Tool` in `lib/types.ts`
2. Add to `Toolbar.tsx`
3. Handle in `Canvas.tsx` mouse handlers + `redraw()`

**New Element Type:**
1. Define interface extending `BaseElement` in `lib/types.ts`
2. Add to `CanvasElement` union
3. Add rendering in `Canvas.tsx` `redraw()`

**New Component Template:**
1. Add to `lib/componentTemplates.ts`
2. Add type to `ComponentType` in `lib/types.ts`

## Additional Documentation

See these files for detailed information:
- `CLAUDE_README.md` - Comprehensive AI agent instructions
- `ARCHITECTURE.md` - Design philosophy and data flow
- `IMPLEMENTATION.md` - Implementation details
- `KNOWN_ISSUES.md` - Issue tracker

# Known Issues

This file tracks known issues in the WireFlow codebase for automated agent review.

## Format

Each issue should include:
- **ID**: Unique identifier (e.g., KI-001)
- **Status**: Open | Fixed | Won't Fix
- **Description**: Brief description of the issue
- **Root Cause**: Technical explanation
- **Fix Location**: Files and lines affected
- **Fixed In**: Commit hash or PR (when fixed)

---

## Issues

### KI-001: Keyboard shortcuts interfere with input fields and dialogs

- **Status**: Fixed
- **Description**: When typing in component name inputs or other input fields, keyboard shortcuts (Backspace, tool shortcuts V/R/O/D/A/L/P/T) trigger canvas actions instead of typing. Also occurred when clicking outside the input but still inside a modal dialog.
- **Root Cause**: Global keyboard handler in Canvas.tsx only checked for `editingElementId`, not other focused input fields or open dialogs
- **Fix Location**: `components/Canvas.tsx` - Added focus detection for input/textarea/contenteditable elements AND checks for `isPromoteDialogOpen` and `confirmDialog.isOpen` at the start of `handleKeyDown`
- **Fixed In**: TBD

### KI-002: Text toolbar clicks cause text editing to end and trigger shortcuts

- **Status**: Fixed
- **Description**: Clicking buttons in the text formatting toolbar (H1, H2, Bold, Italic, alignment, font size) would cause the text textarea to lose focus, ending text editing and allowing keyboard shortcuts to trigger unexpectedly.
- **Root Cause**: The TextToolbar's `onMouseDown` handler only called `stopPropagation()` but not `preventDefault()`. Without `preventDefault()`, the browser's default behavior moves focus away from the textarea.
- **Fix Location**: `components/TextToolbar.tsx` - Added `e.preventDefault()` to the toolbar's `onMouseDown` handler to keep focus on the textarea
- **Fixed In**: TBD

### KI-003: Text toolbar positioned incorrectly when canvas is zoomed or panned

- **Status**: Fixed
- **Description**: The text formatting toolbar appeared at the wrong position (top-left of where it should be) when the canvas was zoomed or panned. This caused clicks on the toolbar to miss and interact with the canvas instead.
- **Root Cause**: The TextToolbar component used raw element coordinates (world space) without applying zoom and pan transformations to convert to screen space.
- **Fix Location**: `components/TextToolbar.tsx` - Added `zoom` and `pan` props, transformed element coordinates to screen space before positioning. `components/Canvas.tsx` - Pass `zoom` and `pan` props to TextToolbar.
- **Fixed In**: TBD

### KI-004: Right side panels (ComponentPanel and DocumentationPanel) share collapse behavior

- **Status**: Fixed (by design)
- **Description**: The ComponentPanel and DocumentationPanel on the right side share a unified collapse/expand behavior. When collapsed, both panels disappear completely and their toggle buttons appear in a shared collapsed strip (`RightPanelStrip`) on the right edge of the screen.
- **Root Cause**: N/A - This is intentional design behavior.
- **Behavior Details**:
  - Each panel can be expanded/collapsed independently
  - The collapsed strip only appears when at least one panel is collapsed
  - Toggle buttons in the strip correspond to whichever panels are currently collapsed
  - **ComponentPanel**: Shows component templates and user-created components. Toggle with the Menu icon.
  - **DocumentationPanel**: Shows frame notes and element annotations. Toggle with the FileText icon or `Ctrl+\`.
- **Fix Location**: `components/RightPanelStrip.tsx` (new), `components/ComponentPanel.tsx`, `components/DocumentationPanel.tsx`, `components/Canvas.tsx`
- **Fixed In**: TBD

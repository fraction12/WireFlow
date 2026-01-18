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

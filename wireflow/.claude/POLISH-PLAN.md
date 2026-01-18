# WireFlow Final Polish Plan

## Overview
Polish the existing WireFlow wireframing application to production quality. No new features - only refinements to make existing functionality work better, feel better, and look better.

## Implementation Instructions

**Read this file at the start of each iteration.** Mark items with [x] as you complete them. Use specialized agents for quality review:
- **product-spec-writer** - Validate requirements
- **technical-lead-architect** - Review architecture decisions
- **qa-failure-hunter** - Identify edge cases
- **code-quality-reviewer** - Review code quality
- **frontend-ui-engineer** - Ensure UI polish

**Completion:** Output `<promise>POLISH COMPLETE</promise>` when all Priority 1-3 items are done.

---

## Priority 1: Ship Blockers

### Error Handling (Critical)
- [ ] **localStorage quota handling** - Add try/catch with user notification when save fails
  - File: lib/persistence.ts
- [ ] **JSON import validation** - Add schema validation with graceful fallback for malformed state
  - File: lib/persistence.ts

### Accessibility (Critical)
- [ ] **Screen reader announcements** - Add aria-live region for canvas operations (selection, creation, deletion)
  - File: components/Canvas.tsx

### Performance (Critical)
- [ ] **Canvas redraw optimization** - Implement dirty region tracking, avoid full redraw on every state change
  - File: components/Canvas.tsx

---

## Priority 2: High Impact / Quick Wins

### Visual Feedback
- [ ] **Auto-save indicator** - Add subtle "Saved" indicator or timestamp
- [ ] **Undo/redo feedback** - Toast notification with step count
- [ ] **Zoom level indicator** - Persistent display with quick-access controls

### Discoverability
- [ ] **Keyboard shortcut help panel** - Add ? key to show all 50+ shortcuts
  - New file: components/ui/KeyboardShortcutsPanel.tsx

### Visual Consistency
- [ ] **Button size standardization** - Establish 32px/36px/40px scale across:
  - components/Toolbar.tsx (currently 48px)
  - components/UnifiedStyleBar.tsx (currently 28px)
  - RightPanelStrip (currently 40px)

---

## Priority 3: High Impact / Medium Effort

### UX Improvements
- [ ] **First-time user experience** - Optional onboarding tooltip sequence
- [ ] **Component insertion position** - Insert at canvas center or cursor position (not fixed 500,400)
- [ ] **Snap-to-grid visual feedback** - Show toggle state and visual indicator when snapping

### Interaction Polish
- [ ] **Color picker keyboard nav** - Wrap HexColorPicker for arrow key support
- [ ] **Drag preview** - Semi-transparent element preview during drag
- [ ] **Cursor feedback** - Context-appropriate cursors (crosshair for draw, rotate cursor, etc.)

### Accessibility
- [ ] **Skip link** - Add skip-to-canvas link for keyboard users
- [ ] **Focus management in text editing** - Improve Tab key exit behavior
- [ ] **Touch target sizes** - Ensure minimum 44x44px on mobile

---

## Priority 4: Polish Items (if time permits)

### Visual Refinement
- [ ] Selection state visual hierarchy (more distinct multi vs single vs group)
- [ ] Hover state consistency (standardize scale transforms)
- [ ] Empty state illustrations (My Components, Documentation panel)
- [ ] Divider styling consistency (create standard Divider component)

### Error Handling
- [ ] Very long text handling (word-break for long strings)
- [ ] Copy/paste ID regeneration verification
- [ ] Component instance orphan handling

### Performance
- [ ] Use structuredClone instead of JSON.parse/stringify in history
- [ ] Add React.memo to ComponentPreview and UserComponentCard
- [ ] Cache text measurements by content+font

---

## Files to Modify

| File | Changes |
|------|---------|
| components/Canvas.tsx | Performance, aria-live, save indicator, zoom display |
| lib/persistence.ts | Error handling, validation |
| components/UnifiedStyleBar.tsx | Button sizing |
| components/Toolbar.tsx | Button sizing, cursors |
| components/ColorPicker.tsx | Keyboard accessibility |
| app/globals.css | Focus states, animation tokens |

## New Files
- `components/ui/KeyboardShortcutsPanel.tsx` - Help overlay
- `components/ui/SaveIndicator.tsx` - Auto-save feedback

---

## Verification

1. **Error handling**: Fill localStorage to quota and verify graceful handling
2. **Accessibility**: Test with screen reader (NVDA/VoiceOver), verify announcements
3. **Performance**: Profile canvas with 100+ elements, verify smooth interaction
4. **Visual consistency**: Audit button sizes across all panels
5. **Keyboard navigation**: Complete full workflow using only keyboard

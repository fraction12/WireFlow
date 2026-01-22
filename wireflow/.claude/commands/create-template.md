---
description: Create a new WireFlow component template (visual-only, no semantic tags)
argument-hint: <component-name> [description]
allowed-tools: Read, Edit, Write
---

# Create WireFlow Component Template

You are creating a new component template for WireFlow's component library.

**IMPORTANT: All templates are VISUAL-ONLY. Do NOT add `semanticTag` or `description` properties to elements. Templates are simple groups of visual elements for sketch-first workflows.**

## Template Structure

All templates are defined in `lib/componentTemplates.ts` and follow this structure:

```typescript
{
  id: 'template-{kebab-case-name}',
  type: '{kebab-case-name}',
  name: '{Display Name}',
  description: '{Brief description of the component}',
  width: {total-width},
  height: {total-height},
  elements: [
    // Array of element definitions - NO semantic tags!
  ],
}
```

## Element Types Available

### Rectangle
```typescript
{
  type: 'rectangle',
  offsetX: number,      // X position relative to component origin
  offsetY: number,      // Y position relative to component origin
  width: number,
  height: number,
}
```

### Text
```typescript
{
  type: 'text',
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,        // Typically 14-20 for standard text
  content: string,
  textAlign?: 'left' | 'center' | 'right',  // Default: 'left'
}
```

### Line
```typescript
{
  type: 'line',
  offsetX: number,
  offsetY: number,
  width: number,         // For horizontal lines
  height: number,        // For vertical lines
  startX: number,        // Same as offsetX for consistency
  startY: number,        // Same as offsetY for consistency
  endX: number,          // startX + width (horizontal) or startX (vertical)
  endY: number,          // startY (horizontal) or startY + height (vertical)
}
```

## Spacing Guidelines

- **Label to input gap**: 24px (offsetY difference)
- **Text vertical centering**: `containerOffsetY + (containerHeight - textHeight) / 2`
- **Text horizontal padding**: 12-16px from container edges
- **Standard text heights**: 14px (small), 16px (body), 18-20px (heading)
- **Standard button/input height**: 32-40px

## Existing ComponentTypes (lib/types.ts lines 65-81)

```typescript
export type ComponentType =
  | 'table'
  | 'table-filters'
  | 'empty-state'
  | 'confirmation-modal'
  | 'simple-form'
  | 'action-footer'
  | 'button'
  | 'text-input'
  | 'dropdown'
  | 'card'
  | 'navigation-bar'
  | 'modal-dialog'
  | 'list-item'
  | 'header'
  | 'footer';
```

## Example: Text Input (Label + Input Box)

```typescript
// ============================================================================
// Text Input - Labeled input field (visual-only, no semantic tags)
// ============================================================================
{
  id: 'template-text-input',
  type: 'text-input',
  name: 'Text Input',
  description: 'Input field with label above',
  width: 240,
  height: 68,
  elements: [
    {
      type: 'text',
      offsetX: 0,
      offsetY: 0,
      width: 100,
      height: 16,
      content: 'Label',
    },
    {
      type: 'rectangle',
      offsetX: 0,
      offsetY: 24,
      width: 240,
      height: 40,
    },
    {
      type: 'text',
      offsetX: 12,
      offsetY: 36,
      width: 216,
      height: 16,
      content: 'Placeholder text...',
    },
  ],
}
```

## Example: Button

```typescript
// ============================================================================
// Button - Simple clickable button
// ============================================================================
{
  id: 'template-button',
  type: 'button',
  name: 'Button',
  description: 'A basic button with centered label',
  width: 120,
  height: 40,
  elements: [
    {
      type: 'rectangle',
      offsetX: 0,
      offsetY: 0,
      width: 120,
      height: 40,
    },
    {
      type: 'text',
      offsetX: 0,
      offsetY: 12,
      width: 120,
      height: 20,
      content: 'Button',
      textAlign: 'center',
    },
  ],
}
```

## Example: Card with Header

```typescript
// ============================================================================
// Card - Content container with header
// ============================================================================
{
  id: 'template-card',
  type: 'card',
  name: 'Card',
  description: 'Content card with header section',
  width: 280,
  height: 200,
  elements: [
    {
      type: 'rectangle',
      offsetX: 0,
      offsetY: 0,
      width: 280,
      height: 200,
    },
    {
      type: 'line',
      offsetX: 0,
      offsetY: 48,
      width: 280,
      height: 0,
      startX: 0,
      startY: 48,
      endX: 280,
      endY: 48,
    },
    {
      type: 'text',
      offsetX: 16,
      offsetY: 14,
      width: 248,
      height: 20,
      content: 'Card Title',
    },
  ],
}
```

## User Request

$ARGUMENTS

## Instructions

1. First, read `lib/componentTemplates.ts` to understand existing patterns
2. If the user provided a screenshot or reference, analyze it for:
   - Overall dimensions
   - Element positions and sizes
   - Text content and alignment
3. Create the template as a simple group of visual elements:
   - **NO `semanticTag` properties**
   - **NO `description` properties on elements**
   - Just rectangles, text, and lines with positions and sizes
4. Add it to the COMPONENT_TEMPLATES array with proper formatting
5. If it's a new type, update `lib/types.ts` ComponentType union

Generate clean, visual-only templates that match WireFlow's sketch-style aesthetic.

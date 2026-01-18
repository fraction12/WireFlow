import type { ComponentTemplate } from './types';

/**
 * Core component templates for WireFlow wireframing
 * Phase 1 - 10 essential UI component templates
 */
export const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  // ============================================================================
  // 1. Button - Simple clickable button
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
        semanticTag: 'button',
        description: 'Primary action button',
      },
      {
        type: 'text',
        offsetX: 60,
        offsetY: 20,
        width: 100,
        height: 20,
        content: 'Button',
      },
    ],
  },

  // ============================================================================
  // 2. Text Input - Labeled input field
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
        semanticTag: 'input',
        description: 'Text input field',
      },
      {
        type: 'text',
        offsetX: 12,
        offsetY: 44,
        width: 200,
        height: 16,
        content: 'Placeholder text...',
      },
    ],
  },

  // ============================================================================
  // 3. Dropdown - Select dropdown with indicator
  // ============================================================================
  {
    id: 'template-dropdown',
    type: 'dropdown',
    name: 'Dropdown',
    description: 'Select dropdown with chevron indicator',
    width: 200,
    height: 40,
    elements: [
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 200,
        height: 40,
        semanticTag: 'input',
        description: 'Dropdown selector',
      },
      {
        type: 'text',
        offsetX: 12,
        offsetY: 20,
        width: 150,
        height: 16,
        content: 'Select...',
      },
      {
        type: 'text',
        offsetX: 176,
        offsetY: 20,
        width: 16,
        height: 16,
        content: 'v',
      },
    ],
  },

  // ============================================================================
  // 4. Card - Content container with header
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
        semanticTag: 'section',
        description: 'Card container',
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
        offsetY: 24,
        width: 200,
        height: 20,
        content: 'Card Title',
      },
    ],
  },

  // ============================================================================
  // 5. Navigation Bar - Top navigation with logo and links
  // ============================================================================
  {
    id: 'template-navigation-bar',
    type: 'navigation-bar',
    name: 'Navigation Bar',
    description: 'Top navigation with logo and menu items',
    width: 800,
    height: 60,
    elements: [
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 60,
        semanticTag: 'section',
        description: 'Navigation bar container',
      },
      {
        type: 'rectangle',
        offsetX: 16,
        offsetY: 14,
        width: 32,
        height: 32,
        description: 'Logo placeholder',
      },
      {
        type: 'text',
        offsetX: 60,
        offsetY: 30,
        width: 60,
        height: 16,
        content: 'Logo',
      },
      {
        type: 'text',
        offsetX: 200,
        offsetY: 30,
        width: 50,
        height: 16,
        content: 'Home',
      },
      {
        type: 'text',
        offsetX: 280,
        offsetY: 30,
        width: 60,
        height: 16,
        content: 'Products',
      },
      {
        type: 'text',
        offsetX: 380,
        offsetY: 30,
        width: 50,
        height: 16,
        content: 'About',
      },
      {
        type: 'text',
        offsetX: 460,
        offsetY: 30,
        width: 60,
        height: 16,
        content: 'Contact',
      },
    ],
  },

  // ============================================================================
  // 6. Modal Dialog - Overlay dialog with header and footer
  // ============================================================================
  {
    id: 'template-modal-dialog',
    type: 'modal-dialog',
    name: 'Modal Dialog',
    description: 'Dialog with header, body, and action buttons',
    width: 400,
    height: 300,
    elements: [
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 300,
        semanticTag: 'section',
        description: 'Modal container',
      },
      // Header area
      {
        type: 'line',
        offsetX: 0,
        offsetY: 56,
        width: 400,
        height: 0,
        startX: 0,
        startY: 56,
        endX: 400,
        endY: 56,
      },
      {
        type: 'text',
        offsetX: 20,
        offsetY: 28,
        width: 300,
        height: 24,
        content: 'Modal Title',
      },
      {
        type: 'text',
        offsetX: 368,
        offsetY: 28,
        width: 20,
        height: 20,
        content: 'X',
      },
      // Body area
      {
        type: 'text',
        offsetX: 20,
        offsetY: 100,
        width: 360,
        height: 16,
        content: 'Modal content goes here...',
      },
      // Footer area
      {
        type: 'line',
        offsetX: 0,
        offsetY: 244,
        width: 400,
        height: 0,
        startX: 0,
        startY: 244,
        endX: 400,
        endY: 244,
      },
      {
        type: 'rectangle',
        offsetX: 200,
        offsetY: 258,
        width: 80,
        height: 32,
        semanticTag: 'button',
        description: 'Cancel button',
      },
      {
        type: 'text',
        offsetX: 240,
        offsetY: 274,
        width: 50,
        height: 16,
        content: 'Cancel',
      },
      {
        type: 'rectangle',
        offsetX: 296,
        offsetY: 258,
        width: 80,
        height: 32,
        semanticTag: 'button',
        description: 'Confirm button',
      },
      {
        type: 'text',
        offsetX: 336,
        offsetY: 274,
        width: 50,
        height: 16,
        content: 'Confirm',
      },
    ],
  },

  // ============================================================================
  // 7. Table 3x3 - Simple data table with header row
  // ============================================================================
  {
    id: 'template-table',
    type: 'table',
    name: 'Table 3x3',
    description: 'Data table with 3 columns and header row',
    width: 450,
    height: 160,
    elements: [
      // Outer border
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 450,
        height: 160,
        semanticTag: 'section',
        description: 'Table container',
      },
      // Header row background (using line for separator)
      {
        type: 'line',
        offsetX: 0,
        offsetY: 40,
        width: 450,
        height: 0,
        startX: 0,
        startY: 40,
        endX: 450,
        endY: 40,
      },
      // Vertical lines (column separators)
      {
        type: 'line',
        offsetX: 150,
        offsetY: 0,
        width: 0,
        height: 160,
        startX: 150,
        startY: 0,
        endX: 150,
        endY: 160,
      },
      {
        type: 'line',
        offsetX: 300,
        offsetY: 0,
        width: 0,
        height: 160,
        startX: 300,
        startY: 0,
        endX: 300,
        endY: 160,
      },
      // Row separators
      {
        type: 'line',
        offsetX: 0,
        offsetY: 80,
        width: 450,
        height: 0,
        startX: 0,
        startY: 80,
        endX: 450,
        endY: 80,
      },
      {
        type: 'line',
        offsetX: 0,
        offsetY: 120,
        width: 450,
        height: 0,
        startX: 0,
        startY: 120,
        endX: 450,
        endY: 120,
      },
      // Header text
      {
        type: 'text',
        offsetX: 75,
        offsetY: 20,
        width: 100,
        height: 16,
        content: 'Column 1',
      },
      {
        type: 'text',
        offsetX: 225,
        offsetY: 20,
        width: 100,
        height: 16,
        content: 'Column 2',
      },
      {
        type: 'text',
        offsetX: 375,
        offsetY: 20,
        width: 100,
        height: 16,
        content: 'Column 3',
      },
      // Row 1 cells
      {
        type: 'text',
        offsetX: 75,
        offsetY: 60,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      {
        type: 'text',
        offsetX: 225,
        offsetY: 60,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      {
        type: 'text',
        offsetX: 375,
        offsetY: 60,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      // Row 2 cells
      {
        type: 'text',
        offsetX: 75,
        offsetY: 100,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      {
        type: 'text',
        offsetX: 225,
        offsetY: 100,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      {
        type: 'text',
        offsetX: 375,
        offsetY: 100,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      // Row 3 cells
      {
        type: 'text',
        offsetX: 75,
        offsetY: 140,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      {
        type: 'text',
        offsetX: 225,
        offsetY: 140,
        width: 100,
        height: 16,
        content: 'Cell',
      },
      {
        type: 'text',
        offsetX: 375,
        offsetY: 140,
        width: 100,
        height: 16,
        content: 'Cell',
      },
    ],
  },

  // ============================================================================
  // 8. List Item - Single item with icon and text
  // ============================================================================
  {
    id: 'template-list-item',
    type: 'list-item',
    name: 'List Item',
    description: 'List item with icon area and text',
    width: 300,
    height: 48,
    elements: [
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 300,
        height: 48,
        description: 'List item container',
      },
      // Icon placeholder
      {
        type: 'rectangle',
        offsetX: 12,
        offsetY: 12,
        width: 24,
        height: 24,
        description: 'Icon placeholder',
      },
      {
        type: 'text',
        offsetX: 48,
        offsetY: 16,
        width: 200,
        height: 16,
        content: 'List item text',
      },
      // Chevron/arrow indicator
      {
        type: 'text',
        offsetX: 276,
        offsetY: 24,
        width: 16,
        height: 16,
        content: '>',
      },
    ],
  },

  // ============================================================================
  // 9. Header - Page header with logo, nav, and action
  // ============================================================================
  {
    id: 'template-header',
    type: 'header',
    name: 'Header',
    description: 'Page header with logo, navigation, and action button',
    width: 800,
    height: 80,
    elements: [
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 80,
        semanticTag: 'section',
        description: 'Header container',
      },
      // Logo area
      {
        type: 'rectangle',
        offsetX: 24,
        offsetY: 20,
        width: 40,
        height: 40,
        description: 'Logo placeholder',
      },
      {
        type: 'text',
        offsetX: 76,
        offsetY: 40,
        width: 80,
        height: 20,
        content: 'Brand',
      },
      // Navigation items
      {
        type: 'text',
        offsetX: 300,
        offsetY: 40,
        width: 60,
        height: 16,
        content: 'Home',
      },
      {
        type: 'text',
        offsetX: 380,
        offsetY: 40,
        width: 70,
        height: 16,
        content: 'Features',
      },
      {
        type: 'text',
        offsetX: 470,
        offsetY: 40,
        width: 60,
        height: 16,
        content: 'Pricing',
      },
      {
        type: 'text',
        offsetX: 550,
        offsetY: 40,
        width: 60,
        height: 16,
        content: 'About',
      },
      // Action button
      {
        type: 'rectangle',
        offsetX: 680,
        offsetY: 24,
        width: 100,
        height: 36,
        semanticTag: 'button',
        description: 'CTA button',
      },
      {
        type: 'text',
        offsetX: 730,
        offsetY: 42,
        width: 70,
        height: 16,
        content: 'Sign Up',
      },
    ],
  },

  // ============================================================================
  // 10. Footer - Page footer with 3 column links
  // ============================================================================
  {
    id: 'template-footer',
    type: 'footer',
    name: 'Footer',
    description: 'Page footer with 3 link columns',
    width: 800,
    height: 120,
    elements: [
      {
        type: 'rectangle',
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 120,
        semanticTag: 'section',
        description: 'Footer container',
      },
      // Column 1
      {
        type: 'text',
        offsetX: 50,
        offsetY: 20,
        width: 100,
        height: 18,
        content: 'Company',
      },
      {
        type: 'text',
        offsetX: 50,
        offsetY: 48,
        width: 80,
        height: 14,
        content: 'About Us',
      },
      {
        type: 'text',
        offsetX: 50,
        offsetY: 70,
        width: 80,
        height: 14,
        content: 'Careers',
      },
      {
        type: 'text',
        offsetX: 50,
        offsetY: 92,
        width: 80,
        height: 14,
        content: 'Blog',
      },
      // Column 2
      {
        type: 'text',
        offsetX: 300,
        offsetY: 20,
        width: 100,
        height: 18,
        content: 'Product',
      },
      {
        type: 'text',
        offsetX: 300,
        offsetY: 48,
        width: 80,
        height: 14,
        content: 'Features',
      },
      {
        type: 'text',
        offsetX: 300,
        offsetY: 70,
        width: 80,
        height: 14,
        content: 'Pricing',
      },
      {
        type: 'text',
        offsetX: 300,
        offsetY: 92,
        width: 80,
        height: 14,
        content: 'Docs',
      },
      // Column 3
      {
        type: 'text',
        offsetX: 550,
        offsetY: 20,
        width: 100,
        height: 18,
        content: 'Support',
      },
      {
        type: 'text',
        offsetX: 550,
        offsetY: 48,
        width: 80,
        height: 14,
        content: 'Help Center',
      },
      {
        type: 'text',
        offsetX: 550,
        offsetY: 70,
        width: 80,
        height: 14,
        content: 'Contact',
      },
      {
        type: 'text',
        offsetX: 550,
        offsetY: 92,
        width: 80,
        height: 14,
        content: 'Status',
      },
    ],
  },
];

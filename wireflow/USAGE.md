# WireFlow Usage Guide

## Quick Start

1. **Start the application**
   ```bash
   pnpm dev
   ```
   Navigate to http://localhost:3000

2. **Select a drawing tool** from the left sidebar:
   - **⌖ Select** - Move and resize elements
   - **□ Rectangle** - Draw boxes (buttons, inputs, sections)
   - **T Text** - Add text labels
   - **→ Arrow** - Draw flow indicators

3. **Draw freely** on the canvas
   - Click and drag to create shapes
   - Click to place text
   - No constraints, no grids - just sketch

4. **Add semantic meaning** when ready:
   - Click **⌖ Select** tool
   - Click on any rectangle or text element
   - Side panel opens on the right
   - Choose a semantic tag: **Button**, **Input**, or **Section**

5. **Annotate tagged elements**:
   - **Description**: What is this element?
   - **Intended Behavior**: What should it do?
   - **Acceptance Notes**: How will you verify it works?

6. **Export your work**:
   - Click **Export JSON** button (top right)
   - Only tagged elements are exported
   - Download contains structured data ready for development

## Drawing Tools

### Rectangle Tool (□)
- **Click and drag** to create a rectangle
- Use for: buttons, input fields, containers, sections
- Can be tagged as: Button, Input, or Section
- Can be moved and resized after creation

### Text Tool (T)
- **Click** to place text on the canvas
- Edit content in the side panel
- Use for: labels, headings, descriptions
- Can be tagged as: Button, Input, or Section
- Can be moved and resized after creation

### Arrow Tool (→)
- **Click and drag** to draw an arrow
- Use for: showing flow, indicating relationships
- Cannot be tagged (arrows are always visual-only)
- Can be moved but not resized

### Select Tool (⌖)
- **Click** to select elements
- **Drag** to move selected elements
- **Drag corners** to resize (rectangles and text only)
- Opens side panel for editing properties

## Visual Indicators

- **Gray elements** (default): Untagged visual sketches
- **Blue outline**: Currently selected element
- **Green elements**: Semantically tagged (will be exported)
- **Blue corner handles**: Resize points for selected element

## Semantic Tags

### Button
Use for interactive elements that trigger actions.

**Example:**
- Description: "Submit button"
- Intended Behavior: "Validates form fields and submits data to /api/login"
- Acceptance Notes: "Should show loading state and handle error messages"

### Input
Use for data entry fields.

**Example:**
- Description: "Email address field"
- Intended Behavior: "Accepts email input with real-time validation"
- Acceptance Notes: "Should reject invalid email formats and show error below field"

### Section
Use for layout containers or grouped elements.

**Example:**
- Description: "User profile card"
- Intended Behavior: "Displays user avatar, name, and bio in a contained area"
- Acceptance Notes: "Should truncate long bios with '...' and show full text on hover"

## Workflow Recommendations

### 1. Rapid Sketching Phase (2-5 minutes)
- Use Rectangle and Text tools liberally
- Draw the entire flow without stopping
- Don't worry about precision or alignment
- Think with your hands, sketch your thoughts
- Draw multiple variations if exploring alternatives

### 2. Refinement Phase (1-2 minutes)
- Use Select tool to adjust positions
- Resize elements for better readability
- Add arrows to show flow
- Delete or move exploratory sketches out of the way
- Don't delete exploratory work - just move it aside

### 3. Tagging Phase (3-5 minutes)
- Identify which elements are interactive (Button, Input)
- Identify which elements are containers (Section)
- Tag only elements that will be implemented
- Leave exploratory sketches untagged

### 4. Annotation Phase (5-10 minutes)
- Add descriptions for context
- Specify behaviors for interactive elements
- Write acceptance criteria for validation
- Think about edge cases and error states

### 5. Export Phase (instant)
- Click "Export JSON"
- Share file with development team
- Untagged sketches remain in the canvas but aren't exported

## Tips and Best Practices

### Do's
✓ Sketch quickly without overthinking
✓ Draw multiple variations side by side
✓ Leave exploratory work on the canvas
✓ Tag only elements you want to implement
✓ Write clear, specific acceptance criteria
✓ Use arrows liberally to show flow
✓ Think in flows, not screens

### Don'ts
✗ Don't try to make it pixel-perfect
✗ Don't delete exploratory sketches
✗ Don't tag everything (only what's structured)
✗ Don't worry about alignment
✗ Don't spend time on visual styling
✗ Don't expect precision - it's intentionally rough

## Example Session

**Goal:** Wireframe a login screen

1. **Sketch** (2 min):
   - Draw 2 rectangles for email and password inputs
   - Add text labels "Email" and "Password"
   - Draw rectangle for "Login" button
   - Draw rectangle for "Forgot password?" link
   - Draw arrow pointing to next screen

2. **Tag** (2 min):
   - Tag email rectangle as "Input"
   - Tag password rectangle as "Input"
   - Tag login button as "Button"
   - Leave "Forgot password?" untagged (will design separately)

3. **Annotate** (5 min):
   - **Email input**:
     - Description: "Email address field"
     - Behavior: "Validates email format on blur"
     - Acceptance: "Reject invalid formats, show red border + error message"

   - **Password input**:
     - Description: "Password field with masked input"
     - Behavior: "Masks input, shows/hides toggle icon"
     - Acceptance: "Min 8 characters, show validation on blur"

   - **Login button**:
     - Description: "Primary CTA to authenticate"
     - Behavior: "Submits form if valid, calls /api/auth, redirects to /dashboard"
     - Acceptance: "Disabled until form valid, shows loading spinner, handles errors"

4. **Export** (instant):
   - Click "Export JSON"
   - File contains 3 tagged elements with full annotations
   - Untagged "Forgot password?" sketch stays in canvas for later work

## Keyboard Shortcuts

Currently no keyboard shortcuts are implemented to maintain simplicity. All actions are mouse-driven.

## Export Format

The exported JSON includes:
- Version number (for future compatibility)
- Export timestamp
- Array of tagged elements with:
  - Unique ID
  - Element type (rectangle, text, arrow)
  - Position (x, y coordinates)
  - Size (width, height)
  - Semantic tag (button, input, section)
  - Annotations (description, behavior, acceptance notes)
  - Content (for text elements)

**Example export:**
```json
{
  "version": "1.0.0",
  "exportedAt": "2026-01-16T10:30:00.000Z",
  "taggedElements": [
    {
      "id": "el_1737024600000_abc123xyz",
      "type": "rectangle",
      "position": { "x": 100, "y": 150 },
      "size": { "width": 300, "height": 45 },
      "semanticTag": "input",
      "annotations": {
        "description": "Email address field",
        "intendedBehavior": "Validates email format on blur",
        "acceptanceNotes": "Should reject invalid email formats and show error message below field"
      }
    }
  ]
}
```

## Common Questions

**Q: Why can't I change colors or fonts?**
A: This is intentional. Early wireframes should focus on structure and behavior, not visual design. Visual styling comes later.

**Q: Why is there no undo?**
A: To keep the tool simple and fast. The workflow encourages rapid sketching where mistakes are acceptable.

**Q: Can I save my work?**
A: Currently no. The tool is designed for quick sessions with immediate export. State is not persisted.

**Q: Why do only tagged elements export?**
A: Exploratory sketches are part of thinking but not part of the deliverable. Export only includes intentional, structured elements.

**Q: Can I add custom semantic tags?**
A: Not currently. The three tags (Button, Input, Section) cover most PM wireframing needs.

**Q: What if I need more complex interactions?**
A: Use the "Intended Behavior" field to describe complex interactions in detail. The wireframe shows structure; the annotation describes behavior.

## Troubleshooting

**Canvas is unresponsive:**
- Refresh the page
- Check browser console for errors
- Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)

**Export button disabled:**
- You need to tag at least one element before exporting
- Select an element with the Select tool and add a semantic tag

**Can't move or resize:**
- Make sure the Select tool (⌖) is active
- Click the element first to select it
- For resizing, drag the blue corner handles

**Side panel not showing:**
- Side panel only appears for selected elements
- Use Select tool to click an element
- Arrows cannot be tagged (side panel won't appear)

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

---

**Happy wireframing! Think fast, sketch rough, structure later.**

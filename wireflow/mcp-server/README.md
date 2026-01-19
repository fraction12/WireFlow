# WireFlow MCP Server

MCP (Model Context Protocol) server that enables Claude Code to interact with the WireFlow wireframing application.

## Architecture

```
┌─────────────────┐     stdio      ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Claude Code   │ <────────────> │   MCP Server    │ <────────────> │  WireFlow App   │
│   (Terminal)    │                │   (Node.js)     │                │  (Browser)      │
└─────────────────┘                └─────────────────┘                └─────────────────┘
```

## Setup

1. Install dependencies:
```bash
cd mcp-server
pnpm install
```

2. Build the server:
```bash
pnpm build
```

3. Configure Claude Code (`~/.claude/mcp_settings.json`):
```json
{
  "mcpServers": {
    "wireflow": {
      "command": "node",
      "args": ["D:/Projects/WireFlow/wireflow/mcp-server/dist/index.js"],
      "env": {
        "WIREFLOW_WS_PORT": "3001"
      }
    }
  }
}
```

4. Start WireFlow:
```bash
pnpm dev
```

5. Restart Claude Code to load the MCP server.

## Available Tools

### Canvas State
- `get_canvas_state` - Get overview of canvas state (frames, element count, selection)
- `get_elements` - Get all elements in the current or specified frame
- `get_selection` - Get currently selected element IDs

### Create Elements
- `create_rectangle` - Create a rectangle element
- `create_ellipse` - Create an ellipse (oval) element
- `create_text` - Create a text element
- `create_arrow` - Create an arrow element
- `create_line` - Create a line element

### Modify Elements
- `update_element` - Update an element's properties
- `delete_elements` - Delete elements by IDs
- `delete_selected` - Delete selected elements

### Selection
- `select_elements` - Select elements by IDs
- `clear_selection` - Clear the selection

### Components
- `create_component` - Create a component from template (button, card, etc.)
- `list_components` - List available component templates

### Frames
- `list_frames` - List all frames in the workspace
- `switch_frame` - Switch to a different frame
- `create_frame` - Create a new frame

## Development

```bash
# Watch mode for development
pnpm dev

# Build for production
pnpm build

# Run the server directly
pnpm start
```

## Troubleshooting

### WireFlow not connecting
- Ensure WireFlow is running in the browser
- Check that port 3001 is not blocked
- Look at the browser console for connection errors

### Commands failing
- Check if WireFlow is connected (server logs will show connection status)
- Verify coordinates are within 0-2000 range
- Check element IDs exist before updating/deleting

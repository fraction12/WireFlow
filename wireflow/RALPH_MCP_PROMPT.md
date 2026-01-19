# WireFlow MCP Server - Ralph Loop Implementation Prompt

## Mission

Build a complete MCP (Model Context Protocol) server that enables Claude Code to interact with the WireFlow wireframing application via natural language commands.

## Success Criteria

Output `<promise>MCP SERVER COMPLETE</promise>` ONLY when ALL of the following are true:

1. MCP server package exists at `mcp-server/` with working TypeScript build
2. WebSocket bridge is implemented in WireFlow and connects successfully
3. All Phase 1 tools are implemented and tested
4. Claude Code can connect to the MCP server
5. At least ONE successful end-to-end test: "create a rectangle" command works

---

## Architecture Overview

```
┌─────────────────┐     stdio      ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Claude Code   │ <────────────> │   MCP Server    │ <────────────> │  WireFlow App   │
│   (Terminal)    │                │   (Node.js)     │                │  (Browser)      │
└─────────────────┘                └─────────────────┘                └─────────────────┘
```

**Key Constraint**: Canvas state lives in React (browser). MCP server runs in Node.js. WebSocket bridges this gap.

---

## Multi-Agent Orchestration Strategy

### PHASE 0: Context Gathering (Use Explore Agent)

Before writing ANY code, use the `Explore` agent to understand:

```
Task subagent_type=Explore:
"Analyze the WireFlow codebase for MCP integration:
1. How does Canvas.tsx manage state? Find setElements, recordSnapshot
2. What are all element types in lib/types.ts?
3. How do component templates work in lib/componentTemplates.ts?
4. How does persistence.ts save/load state?
5. What's the project structure for adding new features?"
```

**Checkpoint**: You understand the codebase before proceeding.

---

### PHASE 1: Architecture Design (Use technical-lead-architect Agent)

Use the architect agent to validate the design:

```
Task subagent_type=technical-lead-architect:
"Design the WebSocket communication protocol between MCP server and WireFlow browser app.
Consider:
- Message format for commands and responses
- Connection lifecycle management
- Error handling patterns
- How to expose React state to external process"
```

**Checkpoint**: You have a clear technical design before implementation.

---

### PHASE 2: MCP Server Package Creation

Create the MCP server package structure:

```
mcp-server/
├── package.json              # Dependencies: @modelcontextprotocol/sdk, ws, typescript
├── tsconfig.json             # TypeScript config targeting ES2022, NodeNext modules
├── src/
│   ├── index.ts              # Entry point - MCP server setup, stdio transport
│   ├── tools/
│   │   ├── index.ts          # Tool registry - exports all tools
│   │   ├── types.ts          # Shared types for tool inputs/outputs
│   │   ├── canvasState.ts    # get_canvas_state, get_elements, get_selection
│   │   ├── createElement.ts  # create_rectangle, create_ellipse, create_text, create_arrow, create_line
│   │   ├── updateElement.ts  # update_element
│   │   ├── deleteElement.ts  # delete_elements, delete_selected
│   │   ├── selection.ts      # select_elements, clear_selection
│   │   ├── components.ts     # create_component, list_components
│   │   └── frames.ts         # list_frames, switch_frame, create_frame
│   ├── websocket/
│   │   ├── client.ts         # WebSocket client - connects to WireFlow
│   │   └── protocol.ts       # Message types, serialization
│   └── utils/
│       └── idGenerator.ts    # Copy WireFlow's ID generation pattern
└── README.md                 # Setup instructions
```

**Key Dependencies**:
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0"
  }
}
```

**Checkpoint**: `cd mcp-server && pnpm install && pnpm build` succeeds.

---

### PHASE 3: WebSocket Bridge in WireFlow

Create the browser-side WebSocket bridge:

#### File: `lib/mcpBridge.ts`

```typescript
// Types for MCP bridge communication
export interface MCPRequest {
  id: string;
  action: 'get_state' | 'command';
  command?: MCPCommand;
}

export interface MCPCommand {
  type: string;
  payload: Record<string, unknown>;
}

export interface MCPResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Bridge callbacks that Canvas.tsx will provide
export interface MCPBridgeCallbacks {
  getState: () => WorkspaceState;
  getElements: () => CanvasElement[];
  getSelection: () => string[];
  addElement: (element: Omit<CanvasElement, 'id'>) => string;
  updateElement: (id: string, updates: Partial<CanvasElement>) => boolean;
  deleteElements: (ids: string[]) => number;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;
  addComponent: (templateType: string, x: number, y: number) => { elementIds: string[], groupId: string } | null;
  listFrames: () => Array<{ id: string, name: string, elementCount: number }>;
  switchFrame: (frameId: string) => boolean;
  createFrame: (name: string, type: FrameType) => string;
}

export function useMCPBridge(callbacks: MCPBridgeCallbacks, enabled: boolean = true) {
  // Implementation: WebSocket connection, message handling, command dispatch
}
```

#### File: `app/api/mcp-ws/route.ts`

Next.js API route that upgrades HTTP to WebSocket. Note: Next.js App Router requires special handling for WebSocket - may need to use a separate WebSocket server on different port.

**Alternative Approach**: Run WebSocket server alongside Next.js dev server:

```typescript
// lib/mcpWebSocketServer.ts - Standalone WebSocket server
import { WebSocketServer } from 'ws';

export function startMCPWebSocketServer(port: number = 3001) {
  const wss = new WebSocketServer({ port });
  // Handle connections, message routing
  return wss;
}
```

**Checkpoint**: WebSocket server starts and accepts connections.

---

### PHASE 4: Canvas.tsx Integration

Modify `components/Canvas.tsx` to integrate the MCP bridge:

1. Import the bridge hook
2. Create callback functions that wrap existing state setters
3. Call `useMCPBridge(callbacks)` in the component
4. Ensure `recordSnapshot()` is called before mutations

```typescript
// In Canvas.tsx, add near other hooks:

const mcpCallbacks: MCPBridgeCallbacks = useMemo(() => ({
  getState: () => ({
    version: 1,
    frames,
    componentGroups,
    elementGroups,
    userComponents,
    componentInstances,
    activeFrameId,
  }),
  getElements: () => elements,
  getSelection: () => Array.from(selectedElementIds),
  addElement: (elementData) => {
    recordSnapshot();
    const id = generateId();
    const newElement = { ...elementData, id } as CanvasElement;
    setElements([...elements, newElement]);
    return id;
  },
  updateElement: (id, updates) => {
    const element = elements.find(el => el.id === id);
    if (!element) return false;
    recordSnapshot();
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
    return true;
  },
  deleteElements: (ids) => {
    const idsSet = new Set(ids);
    const toDelete = elements.filter(el => idsSet.has(el.id));
    if (toDelete.length === 0) return 0;
    recordSnapshot();
    setElements(elements.filter(el => !idsSet.has(el.id)));
    return toDelete.length;
  },
  // ... other callbacks
}), [elements, frames, selectedElementIds, /* other deps */]);

useMCPBridge(mcpCallbacks, true);
```

**Checkpoint**: Canvas.tsx builds without errors with bridge integrated.

---

### PHASE 5: MCP Tool Implementation

Implement each tool following this pattern:

```typescript
// Example: mcp-server/src/tools/createElement.ts
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { WebSocketClient } from '../websocket/client.js';

const createRectangleSchema = z.object({
  x: z.number().min(0).max(2000),
  y: z.number().min(0).max(2000),
  width: z.number().min(10).max(2000),
  height: z.number().min(10).max(2000),
  strokeColor: z.string().optional(),
  fillColor: z.string().optional(),
});

export function registerCreateElementTools(server: McpServer, wsClient: WebSocketClient) {
  server.tool(
    'create_rectangle',
    'Create a rectangle element on the canvas',
    createRectangleSchema.shape,
    async (params) => {
      const response = await wsClient.sendCommand({
        type: 'add_element',
        payload: {
          type: 'rectangle',
          ...params,
        },
      });

      if (!response.success) {
        return { content: [{ type: 'text', text: `Error: ${response.error}` }] };
      }

      return {
        content: [{
          type: 'text',
          text: `Created rectangle with ID: ${response.data.elementId}`,
        }],
      };
    }
  );

  // Similar for create_ellipse, create_text, create_arrow, create_line
}
```

**Phase 1 Tools to Implement**:

| Tool | Input | Output |
|------|-------|--------|
| `get_canvas_state` | none | `{ activeFrameId, frames[], elementCount }` |
| `get_elements` | `{ frameId? }` | `{ elements[] }` |
| `get_selection` | none | `{ selectedIds[] }` |
| `list_frames` | none | `{ frames[] }` |
| `create_rectangle` | `{ x, y, width, height, strokeColor?, fillColor? }` | `{ elementId }` |
| `create_ellipse` | `{ x, y, width, height, strokeColor?, fillColor? }` | `{ elementId }` |
| `create_text` | `{ x, y, content, fontSize?, textAlign? }` | `{ elementId }` |
| `create_line` | `{ startX, startY, endX, endY, strokeColor? }` | `{ elementId }` |
| `create_arrow` | `{ startX, startY, endX, endY, strokeColor? }` | `{ elementId }` |
| `update_element` | `{ elementId, updates: {...} }` | `{ success }` |
| `delete_elements` | `{ ids[] }` | `{ deletedCount }` |
| `delete_selected` | none | `{ deletedCount }` |
| `select_elements` | `{ ids[] }` | `{ success }` |
| `clear_selection` | none | `{ success }` |
| `create_component` | `{ template, x, y }` | `{ elementIds[], groupId }` |
| `list_components` | none | `{ templates[] }` |

**Checkpoint**: All Phase 1 tools are registered and handle basic cases.

---

### PHASE 6: Code Review (Use code-quality-reviewer Agent)

After implementation, use the reviewer agent:

```
Task subagent_type=code-quality-reviewer:
"Review the MCP server implementation in mcp-server/ and lib/mcpBridge.ts.
Focus on:
1. Error handling completeness
2. Type safety
3. Connection lifecycle management
4. Race conditions in WebSocket communication
5. Memory leaks in event listeners"
```

**Checkpoint**: Address all high-priority issues from review.

---

### PHASE 7: Testing (Use qa-failure-hunter Agent)

Use the QA agent to find edge cases:

```
Task subagent_type=qa-failure-hunter:
"Analyze the MCP server for WireFlow. Find potential failure modes:
1. What happens if WireFlow isn't running?
2. What if WebSocket disconnects mid-command?
3. What if element ID doesn't exist?
4. What if coordinates are out of bounds?
5. What if user modifies canvas while command is processing?"
```

**Checkpoint**: Handle identified failure modes gracefully.

---

### PHASE 8: Integration Testing

1. Start WireFlow: `pnpm dev`
2. Build MCP server: `cd mcp-server && pnpm build`
3. Test WebSocket connection manually
4. Configure Claude Code MCP settings
5. Test end-to-end: Ask Claude to "create a rectangle at 100, 100"

**Claude Code Configuration** (`~/.claude/mcp_settings.json`):
```json
{
  "mcpServers": {
    "wireflow": {
      "command": "node",
      "args": ["D:/Projects/WireFlow/wireflow/mcp-server/dist/index.js"],
      "env": {
        "WIREFLOW_WS_URL": "ws://localhost:3001"
      }
    }
  }
}
```

**Checkpoint**: End-to-end command works.

---

## Iteration Guidelines

On each Ralph Loop iteration:

1. **Check current state**: What's been built? What's broken?
2. **Identify next action**: Use the phase checklist above
3. **Use appropriate agent**: Match the task to the right specialized agent
4. **Verify before proceeding**: Each phase has a checkpoint
5. **Fix before advancing**: Don't move to next phase with broken code

## Error Recovery

If you encounter errors:

1. **Build errors**: Fix TypeScript/syntax issues first
2. **Runtime errors**: Add error handling, check WebSocket connection
3. **Logic errors**: Use Explore agent to re-examine WireFlow patterns
4. **Integration errors**: Verify both sides of WebSocket communication

## Files to Create/Modify Summary

### New Files:
- `mcp-server/package.json`
- `mcp-server/tsconfig.json`
- `mcp-server/src/index.ts`
- `mcp-server/src/tools/*.ts` (8 files)
- `mcp-server/src/websocket/client.ts`
- `mcp-server/src/websocket/protocol.ts`
- `mcp-server/src/utils/idGenerator.ts`
- `lib/mcpBridge.ts`
- `lib/mcpWebSocketServer.ts` (if using standalone WS server)

### Modified Files:
- `components/Canvas.tsx` - Add bridge integration
- `package.json` - Add ws dependency if needed

---

## Current Iteration Status

<!-- Ralph will update this section each iteration -->

**Iteration**: COMPLETE
**Phase**: 8 - Integration Testing (Ready for manual verification)
**Last Action**: Code review and QA complete, critical fixes applied
**Next Action**: Manual end-to-end test in browser
**Blockers**: None

### Completed Phases:
- ✅ Phase 0: Context gathering
- ✅ Phase 1: Architecture design (WebSocket server in MCP, client in browser)
- ✅ Phase 2: MCP server package (`pnpm build` passes)
- ✅ Phase 3: WebSocket bridge (`lib/mcpBridge.ts`)
- ✅ Phase 4: Canvas.tsx integration (hook integrated)
- ✅ Phase 5: All 16 MCP tools implemented
- ✅ Phase 6: Code review (critical issues fixed)
- ✅ Phase 7: QA analysis (failure modes documented)
- ⏳ Phase 8: Manual end-to-end test required

### Critical Fixes Applied:
1. Added coordinate validation (0-2000 canvas bounds)
2. Added dimension validation (min 1px)
3. Fixed snapshot timing (validate before recordSnapshot)
4. Added clampToCanvas for safe coordinate handling

### Files Created/Modified:
- `mcp-server/` - Complete MCP server package
- `lib/mcpBridge.ts` - WebSocket bridge with validation
- `components/Canvas.tsx` - MCP bridge integration

### Ready for End-to-End Test:
1. Start WireFlow: `pnpm dev`
2. Start MCP server: `node mcp-server/dist/index.js`
3. Open WireFlow in browser (http://localhost:3000)
4. Check browser console for "[MCP Bridge] Connected" message
5. Test via MCP: Create element, verify on canvas

---

## Remember

- WireFlow uses NO global state - everything flows through Canvas.tsx
- All mutations must call `recordSnapshot()` for undo support
- Canvas is fixed 2000x2000 - validate coordinates
- Element IDs follow pattern: `el_${timestamp}_${random}`
- Test incrementally - don't build everything before testing anything

---

**DO NOT output the completion promise until ALL checkpoints pass and end-to-end test succeeds.**

# Running the MCP Server Ralph Loop

## Quick Start

### Option 1: Interactive Ralph Loop (Recommended)

Run this command in Claude Code:

```
/ralph-loop "Follow the instructions in RALPH_MCP_PROMPT.md to build the WireFlow MCP server. Use the multi-agent approach described in the prompt." --max-iterations 25 --completion-promise "MCP SERVER COMPLETE"
```

### Option 2: Manual Execution

If you prefer to run iterations manually:

```bash
claude-code --continue < RALPH_MCP_PROMPT.md
```

Then repeat after each completion.

---

## What the Ralph Loop Will Do

### Iteration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Iteration 1: Context Gathering                                 │
│  └─> Explore agent analyzes codebase                           │
├─────────────────────────────────────────────────────────────────┤
│  Iteration 2-3: Architecture Design                             │
│  └─> technical-lead-architect validates WebSocket design        │
├─────────────────────────────────────────────────────────────────┤
│  Iteration 4-8: MCP Server Package                              │
│  └─> Creates package.json, tsconfig, entry point, tools         │
├─────────────────────────────────────────────────────────────────┤
│  Iteration 9-12: WebSocket Bridge                               │
│  └─> Implements browser-side bridge, Canvas.tsx integration     │
├─────────────────────────────────────────────────────────────────┤
│  Iteration 13-18: Tool Implementation                           │
│  └─> Builds all 15+ MCP tools                                   │
├─────────────────────────────────────────────────────────────────┤
│  Iteration 19-22: Code Review & QA                              │
│  └─> code-quality-reviewer and qa-failure-hunter agents         │
├─────────────────────────────────────────────────────────────────┤
│  Iteration 23-25: Integration Testing                           │
│  └─> End-to-end testing, bug fixes                              │
├─────────────────────────────────────────────────────────────────┤
│  Completion: <promise>MCP SERVER COMPLETE</promise>             │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Agent Usage

The prompt instructs Claude to use specialized agents at each phase:

| Phase | Agent | Purpose |
|-------|-------|---------|
| 0 | `Explore` | Understand WireFlow codebase structure |
| 1 | `technical-lead-architect` | Validate WebSocket protocol design |
| 5 | `feature-dev:code-architect` | Design tool implementations |
| 6 | `code-quality-reviewer` | Review for bugs, security, maintainability |
| 7 | `qa-failure-hunter` | Find edge cases and failure modes |

---

## Monitoring Progress

### Check Iteration Status

The prompt includes an "Iteration Status" section that gets updated:

```markdown
## Current Iteration Status

**Iteration**: 5
**Phase**: 2 - MCP Server Package Creation
**Last Action**: Created package.json and tsconfig.json
**Next Action**: Create entry point index.ts
**Blockers**: None
```

### Checkpoints

Each phase has explicit checkpoints:

- **Phase 2**: `cd mcp-server && pnpm install && pnpm build` succeeds
- **Phase 3**: WebSocket server starts and accepts connections
- **Phase 4**: Canvas.tsx builds without errors
- **Phase 5**: All tools registered and handle basic cases
- **Phase 8**: End-to-end command works

---

## Canceling the Loop

If you need to stop:

```
/cancel-ralph
```

This removes the loop state file and stops further iterations.

---

## After Completion

### 1. Configure Claude Code

Add to `~/.claude/mcp_settings.json`:

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

### 2. Start WireFlow

```bash
pnpm dev
```

### 3. Test MCP Connection

In a new Claude Code session:

```
"What elements are on the WireFlow canvas?"
"Create a rectangle at position 100, 200 with size 150x100"
"Add a login form in the center"
```

---

## Troubleshooting

### "WireFlow not reachable"

1. Ensure WireFlow is running: `pnpm dev`
2. Check WebSocket port (default 3001)
3. Verify no firewall blocking localhost

### "Tool not found"

1. Rebuild MCP server: `cd mcp-server && pnpm build`
2. Restart Claude Code to reload MCP config

### "Element not created"

1. Check browser console for WebSocket errors
2. Verify Canvas.tsx has bridge hook integrated
3. Check element coordinates are within 0-2000

### Ralph Loop stuck

If iterations aren't progressing:

1. Check for build errors blocking progress
2. Review last iteration's output
3. Consider `/cancel-ralph` and manual debugging

---

## Files Created by Ralph Loop

```
wireflow/
├── mcp-server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── tools/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── canvasState.ts
│   │   │   ├── createElement.ts
│   │   │   ├── updateElement.ts
│   │   │   ├── deleteElement.ts
│   │   │   ├── selection.ts
│   │   │   ├── components.ts
│   │   │   └── frames.ts
│   │   ├── websocket/
│   │   │   ├── client.ts
│   │   │   └── protocol.ts
│   │   └── utils/
│   │       └── idGenerator.ts
│   └── dist/           # Built output
│       └── index.js
├── lib/
│   ├── mcpBridge.ts
│   └── mcpWebSocketServer.ts
└── components/
    └── Canvas.tsx      # Modified with bridge integration
```

---

## Expected Duration

- **Iterations**: 15-25
- **With fast model**: ~20-40 minutes
- **With thorough review**: ~45-60 minutes

The multi-agent approach adds some overhead but produces higher quality, reviewed code.

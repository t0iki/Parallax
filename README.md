# Zanki

Browser-based task management with Claude Code integration. Run multiple Claude Code agents in isolated git worktrees, each working on a separate ticket.

## Prerequisites

- Node.js v22.5+ (`node:sqlite`)
- pnpm
- tmux

## Setup

```bash
pnpm install
```

## Usage

Start two processes in separate terminals:

```bash
# API server + WebSocket server (port 3001, hot reload)
pnpm dev:server

# Vite dev server (port 5173)
pnpm dev
```

Open http://localhost:5173.

### Workflow

1. **Settings** — Register working directories (repo path, main branch, branch naming template)
2. **Create tickets** — Add tickets to the board, optionally with descriptions and subtasks
3. **Start a ticket** — Click ▶, select a directory. Zanki creates a git worktree and launches Claude Code in a tmux session
4. **Monitor** — Click a ticket to view its terminal, diff, or edit its description
5. **Create PR** — Click "PR作成" in the ticket detail panel
6. **Delete** — Removes the ticket, worktree, branch, and tmux session

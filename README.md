# Zanki

Browser-based task management with Claude Code integration. Run multiple Claude Code agents in isolated git worktrees, each working on a separate ticket.

## Prerequisites

- [Homebrew](https://brew.sh)

Everything else (mise, Node.js, pnpm, tmux) is installed automatically by `make setup`.

## Setup

```bash
make setup
```

Installs missing prerequisites (Node.js, pnpm, tmux) via Homebrew, runs `pnpm install`, and links the `zanki` command globally.

## Usage

```bash
zanki
```

Opens at http://localhost:5173. Starts both the API server (port 3001) and Vite dev server. Press Ctrl+C to stop.

Alternatively, from the project directory:

```bash
pnpm start
```

### Workflow

1. **Settings** — Register working directories (repo path, main branch, branch naming template)
2. **Create tickets** — Add tickets to the board with descriptions and subtasks
3. **Start a ticket** — Click ▶, select a directory. Zanki creates a git worktree and launches Claude Code in a background tmux session
4. **Monitor** — Click a ticket to view its terminal, diff, or edit its description. Work continues even when the browser is closed
5. **Create PR** — Click "PR作成" in the ticket detail panel
6. **Delete** — Removes the ticket, worktree, branch, and tmux session

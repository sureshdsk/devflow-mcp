# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DevFlow MCP is a Context-First Kanban system for AI agents. It provides an MCP (Model Context Protocol) server that AI agents use to manage tasks, plus a Next.js web UI for humans to visualize and interact with the board.

## Commands

```bash
# Development
bun install          # Install dependencies
bun dev              # Start web UI (localhost:3000)
bun run mcp          # Start MCP server (requires Bun)

# Quality checks
bun typecheck        # TypeScript type checking
bun lint             # ESLint

# Database
bun run db:generate  # Generate migrations from schema changes
bun run db:push      # Push schema to database
bun run db:studio    # Open Drizzle Studio for DB inspection
bun run db:init      # Initialize database (run after fresh clone)

# CLI (when installed globally)
devflow init         # Initialize database
devflow dev          # Start web UI
devflow mcp          # Start MCP server
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AI AGENTS                                       │
│                    (Claude Desktop, Cursor, etc.)                           │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ MCP Protocol (stdio)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP SERVER (Bun)                                   │
│                         src/mcp/server.ts                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Project Tools   │  │ Task Tools      │  │ Agent Tools     │              │
│  │ - list_projects │  │ - create_task   │  │ - check_in      │              │
│  │ - create_project│  │ - update_task   │  │ - check_out     │              │
│  │ - get_or_create │  │ - bulk_create   │  │ - log_activity  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                                  │                                           │
│                    src/db/index-bun.ts (bun:sqlite)                         │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌───────────────────────────────┐  ┌───────────────────────────────────────────┐
│      SQLite Database          │  │         WebSocket Server (:3001)          │
│   ~/.devflow/devflow.db       │  │         src/mcp/websocket.ts              │
│                               │  │                                           │
│  ┌─────────┐ ┌─────────┐     │  │  broadcastUpdate() on all mutations       │
│  │Projects │→│Features │     │  └─────────────────────┬─────────────────────┘
│  └─────────┘ └────┬────┘     │                        │
│                   ↓          │                        │ Real-time updates
│             ┌─────────┐      │                        ▼
│             │ Tasks   │      │  ┌───────────────────────────────────────────┐
│             └────┬────┘      │  │            WEB UI (Next.js/Node)          │
│                  ↓           │  │              src/app/                      │
│  ┌─────────┐ ┌─────────┐    │  │                                           │
│  │ Files   │ │Activity │    │  │  ┌─────────────┐  ┌─────────────────────┐ │
│  └─────────┘ └─────────┘    │  │  │Project Tabs │  │ Kanban Board        │ │
│                              │  │  │(filter view)│  │ (drag-drop tasks)   │ │
└───────────────────────────────┘  │  └─────────────┘  └─────────────────────┘ │
                    ▲              │                                           │
                    │              │         src/db/index.ts (better-sqlite3)  │
                    │              └─────────────────────┬─────────────────────┘
                    │                                    │
                    │         REST API                   │
                    │  ┌─────────────────────────────────┘
                    │  │  /api/projects (GET, POST)
                    │  │  /api/tasks (GET, POST)
                    │  │  /api/tasks/[id] (GET, PATCH, DELETE)
                    └──┴──────────────────────────────────────────────────────
```

### Core Components

1. **MCP Server** (`src/mcp/server.ts`) - Runs on Bun
   - stdio-based MCP server using `@modelcontextprotocol/sdk`
   - 20+ tools for project/feature/task/file management
   - Agent check-in/check-out workflow for task assignment
   - Uses `src/db/index-bun.ts` with `bun:sqlite` driver

2. **Web UI** (`src/app/`) - Runs on Node.js
   - Next.js 16 App Router with React 19
   - Project tabs for filtering, Kanban board with drag-drop
   - Uses `src/db/index.ts` with `better-sqlite3` driver
   - Real-time updates via WebSocket connection to localhost:3001

3. **Database** (`~/.devflow/devflow.db`)
   - SQLite with WAL mode for concurrent access
   - Drizzle ORM with typed schema
   - Two drivers: `bun:sqlite` (MCP) and `better-sqlite3` (Next.js)

4. **WebSocket Server** (`src/mcp/websocket.ts`)
   - Runs on port 3001, started by MCP server
   - Broadcasts all mutations to connected UI clients

### Data Model

```
Projects (top-level container)
    │
    ├── Features (optional grouping)
    │       │
    │       └── Tasks
    │
    └── Tasks (can belong directly to project)
            │
            ├── Files (attachments)
            └── AgentActivity (audit log)
```

### Key Patterns

- **Task Status Flow**: `backlog` → `todo` → `in_progress` → `done`
- **Agent Workflow**: Agents call `check_in` (sets `in_progress`), work, then `check_out` (sets `done`)
- **Auto-Project Creation**: `create_task` accepts `projectName` and auto-creates project if missing
- **File Attachments**: Markdown, images, PDFs can be attached to projects, features, or tasks
- **Real-time Sync**: MCP server broadcasts all mutations via `broadcastUpdate()` to WebSocket clients

## Code Conventions

- Use `bun` (not npm/yarn) for all package management
- TypeScript strict mode is enabled; avoid `any` types
- Path alias: `@/*` maps to `src/*`
- Tailwind CSS 4 with neubrutalism design (bold colors, thick borders, hard shadows)
- Commit style: Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)

## MCP Tool Categories

| Category | Tools |
|----------|-------|
| Projects | `list_projects`, `create_project`, `get_project`, `update_project`, `get_or_create_project` |
| Features | `list_features`, `create_feature`, `create_features_bulk`, `get_feature`, `update_feature` |
| Tasks | `list_tasks`, `get_task`, `create_task` (supports `projectName`), `create_tasks_bulk`, `update_task` |
| Files | `upload_file`, `list_files`, `get_file`, `update_file` |
| Agent | `check_in`, `check_out`, `log_activity`, `get_activity_log` |

## Database Migrations

```bash
# After modifying src/db/schema.ts:
bun run db:generate   # Creates migration in drizzle/

# To test fresh:
rm ~/.devflow/devflow.db && bun run db:init
```

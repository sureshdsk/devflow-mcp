# AGENTS.md

This file provides guidance to AI coding agents (Codex, Claude Code, Cursor, etc.) when working in this repository.

## Project Overview

DevFlow MCP is a spec-driven Kanban system for AI agents. Agents write planning artifacts (`proposal -> specs + design -> tasks`) that humans review and approve in the web UI. Only after the `tasks` artifact is approved can tasks be promoted to the Kanban board.

## Commands

```bash
# Development
pnpm install         # Install dependencies
pnpm dev             # Start Hono API server + Vite dev server (localhost:3000)
pnpm dev:server      # Start Hono API server only
pnpm dev:client      # Start Vite dev server only
pnpm mcp             # Start MCP server

# Quality checks
pnpm typecheck       # TypeScript type checking
pnpm lint            # ESLint

# Build
pnpm build           # Build client (Vite) + server (tsup)
pnpm build:client    # Vite → dist/public/
pnpm build:server    # tsup → dist/server/
pnpm start           # Run production server (node dist/server/start.js)

# Database
pnpm db:generate     # Generate migrations from schema changes
pnpm db:push         # Push schema to database
pnpm db:init         # Initialize database (run after fresh clone)

# Release
pnpm release:patch   # Bump patch version, commit, tag, push
pnpm release:minor   # Bump minor version, commit, tag, push
pnpm release:major   # Bump major version, commit, tag, push

# CLI (when installed globally)
devflow init         # Initialize DB + install skills/commands
devflow dev          # Start web UI
devflow mcp          # Start MCP server
```

## Architecture

```
AI Agents (Codex/Claude/Cursor)
  -> MCP protocol (stdio)
MCP Server (tsx, src/mcp/server.ts)
  -> Spec artifacts on disk (./devflow/specs/*)
  -> SQLite/libSQL DB (~/.devflow/devflow.db)
  -> WebSocket broadcast server (src/websocket/server.ts, :3001)
Hono API Server (src/server/)
  -> API routes (src/server/routes/)
  -> Static file serving (dist/public/)
  -> SPA fallback
Web UI (Vite SPA, src/main.tsx)
  -> Kanban board (/)
  -> Spec editor + approval (/specs/:name)
```

## Core Components

1. MCP server (`src/mcp/server.ts`)

- stdio MCP server using `@modelcontextprotocol/sdk`
- Project/spec/task/agent tools
- Uses `src/db/index.ts` with `@libsql/client`

2. Hono API server (`src/server/`)

- `src/server/start.ts` — entry point, starts HTTP + WebSocket servers
- `src/server/index.ts` — Hono app with route mounting + static serving
- `src/server/routes/` — API route handlers (tasks, projects, specs, agents)

3. Web UI (`src/main.tsx`, `src/pages/`, `src/components/`)

- Vite SPA with React 19 + react-router-dom
- `/` Kanban board (drag/drop)
- `/specs/:name` artifact editor + approve/promote flow
- Real-time updates via WebSocket (`localhost:3001`)

4. Specs on disk (`./devflow/specs/`)

- Source of truth for planning artifacts
- Per-spec files: `proposal.md`, `specs.md`, `design.md`, `tasks.md`, `.approvals.json`, `.meta.json`
- Approval state stores SHA256 content hash; editing approved artifacts auto-revokes approval

5. Database (`~/.devflow/devflow.db`)

- libSQL/SQLite + WAL mode
- Drizzle ORM tables: `projects`, `tasks`, `agent_activity`
- Promoted tasks reference spec by name (`specName` text field)

## Data Model

```
./devflow/specs/
  <spec-name>/
    proposal.md
    specs.md
    design.md
    tasks.md
    .approvals.json
    .meta.json

~/.devflow/devflow.db
  projects
  tasks (specName -> spec folder name)
  agentActivity
```

## Spec Workflow (Approval-Gated DAG)

```
proposal -> (specs, design) -> tasks -> [Promote to Kanban]
```

- Artifact states: `blocked` | `ready` | `in_review` | `done`
- Agents write via `write_artifact`
- Humans approve via web UI (`/specs/:name`) or `approve_artifact`
- Editing approved artifacts revokes approval
- `promote_spec` parses `tasks.md` (`## Task:` headings) and inserts DB tasks

## Key Patterns

- Specs are created by agents only (`create_spec`); no create-spec UI
- Task status flow: `backlog -> todo -> in_progress -> done`
- Agent flow: `check_in` (sets `in_progress`) -> work -> `check_out` (sets `done`)
- MCP mutations broadcast to UI clients via `broadcastUpdate()`

## Code Conventions

- Use `pnpm` for package management
- TypeScript strict mode; avoid `any`
- Path alias: `@/*` -> `src/*`
- Tailwind CSS 4 with neubrutalism visual style
- Conventional commit prefixes: `feat:`, `fix:`, `docs:`, etc.
- Do not add `.js` extensions to TypeScript imports

## MCP Tool Categories

| Category | Tools                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Projects | `list_projects`, `create_project`, `get_project`, `update_project`, `get_or_create_project`                                                                                                                  |
| Specs    | `create_spec`, `list_specs`, `get_spec`, `get_spec_status`, `write_artifact`, `get_artifact`, `get_artifact_template`, `approve_artifact`, `draft_artifact`, `validate_spec`, `promote_spec`, `archive_spec` |
| Tasks    | `list_tasks`, `get_task`, `create_task`, `create_tasks_bulk`, `update_task`                                                                                                                                  |
| Agent    | `check_in`, `check_out`, `log_activity`, `get_activity_log`                                                                                                                                                  |

## AI Agent Integration

Codex config is committed at `.codex/config.toml`:

```toml
[mcp_servers.devflow]
command = "devflow"
args = ["mcp"]
```

Skills and slash commands install locations:

- Codex: `.codex/skills/` (project) and `~/.codex/prompts/` (global)
- Claude Code: `.claude/skills/` and `.claude/commands/df/`

Install/update:

```bash
devflow tool install                     # autodetect tools
devflow tool install --only codex       # Codex only
devflow tool install --only claudecode  # Claude Code only
devflow tool install --tools codex      # explicit tool selection
devflow tool install --no-autodetect    # target all supported tools
devflow tool update                     # rewrite managed sections
```

`devflow init` also runs `tool install` automatically.

Available slash commands: `/df:new`, `/df:continue`, `/df:status`, `/df:validate`, `/df:promote`, `/df:apply`, `/df:archive`, `/df:schema`

## Local Development Build & Install

To test the package locally as if installed globally:

```bash
# 1. Build
pnpm build

# 2. Install globally from local path
npm install -g .

# Verify
devflow --help
```

Restore published package:

```bash
npm install -g @sureshdsk/devflow-mcp
```

Rebuild rules:

- MCP server changes: no web rebuild needed (`devflow mcp` runs `src/mcp/server.ts` via tsx)
- Web UI changes: run `pnpm build` before testing via `devflow dev`
- During active UI development, use `pnpm dev` for hot reload (Vite + Hono concurrently)

## Database Migrations

```bash
# After modifying src/db/schema.ts:
pnpm db:generate
pnpm db:push

# Test from clean DB:
rm ~/.devflow/devflow.db && pnpm db:init
```

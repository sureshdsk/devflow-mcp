# DevFlow Agent Guide

How to use DevFlow effectively as an AI agent.

## The Workflow

```
1. CHECK IN  → Claim a task before starting
2. DO WORK   → Execute, log progress
3. CHECK OUT → Complete with summary (or mark interrupted)
```

## Quick Example

```javascript
// Find work
list_tasks({ status: "todo" })

// Claim it
check_in({
  taskId: "task-123",
  agentName: "Claude",
  executionPlan: "1. Read code 2. Implement 3. Test"
})

// Do the work...

// Complete it
check_out({
  taskId: "task-123",
  agentName: "Claude",
  summary: "Implemented user auth. All tests passing."
})
```

## Data Model

```
Project
├── Feature (optional grouping)
│   ├── Files (planning docs)
│   └── Tasks
└── Tasks (can be directly under project)
```

### Task Statuses

| Status | Meaning |
|--------|---------|
| `backlog` | Not ready |
| `todo` | Ready to pick up |
| `in_progress` | Agent is working (via check_in) |
| `interrupted` | Paused/blocked |
| `done` | Completed (via check_out) |

## Common Patterns

### Starting a Session

```javascript
// 1. Orient
list_projects()
get_project({ projectId: "..." })

// 2. Find work
list_tasks({ projectId: "...", status: "todo" })

// 3. Claim and start
check_in({
  taskId: "...",
  agentName: "Claude",
  executionPlan: "Step by step plan..."
})
```

### Planning a New Feature

```javascript
// 1. Create feature
create_feature({
  projectId: "...",
  name: "User Authentication"
})

// 2. Add planning doc
upload_file({
  featureId: "...",
  name: "plan.md",
  type: "markdown",
  content: "# Auth Plan\n\n## Goals\n- JWT auth\n- Login/logout\n..."
})

// 3. Create tasks
create_tasks_bulk({
  projectId: "...",
  featureId: "...",
  tasks: [
    { title: "Set up JWT", priority: "high", context: "Use jsonwebtoken" },
    { title: "Create endpoints", priority: "high", context: "POST /auth/login" }
  ]
})
```

### When Blocked

```javascript
update_task({
  taskId: "...",
  status: "interrupted",
  context: `DONE: Token generation
REMAINING: Token validation
BLOCKED: Need database credentials
NEXT STEP: Configure DATABASE_URL in .env`
})
```

### Resuming Interrupted Work

```javascript
// 1. Find interrupted tasks
list_tasks({ status: "interrupted" })

// 2. Get context
get_task({ taskId: "..." })
get_activity_log({ taskId: "..." })

// 3. Resume
check_in({
  taskId: "...",
  agentName: "Claude",
  executionPlan: "Resuming: 1. Check DB 2. Complete validation"
})
```

## Tool Reference

### Projects

| Tool | Purpose |
|------|---------|
| `list_projects` | List all projects |
| `create_project` | Create new project |
| `get_project` | Get project with features/tasks |
| `get_or_create_project` | Find or create by name |

### Features

| Tool | Purpose |
|------|---------|
| `list_features` | List features in project |
| `create_feature` | Create new feature |
| `get_feature` | Get feature with tasks/files |

### Tasks

| Tool | Purpose |
|------|---------|
| `list_tasks` | List/filter tasks |
| `create_task` | Create single task |
| `create_tasks_bulk` | Create multiple tasks |
| `get_task` | Get task with context |
| `update_task` | Update task |

### Files

| Tool | Purpose |
|------|---------|
| `upload_file` | Upload markdown/images |
| `list_files` | List files |
| `get_file` | Get file content |
| `update_file` | Update file |

### Agent

| Tool | Purpose |
|------|---------|
| `check_in` | Start working on task |
| `check_out` | Finish task |
| `log_activity` | Log progress |
| `get_activity_log` | Get task history |

## Best Practices

**Do:**
- Always check_in before starting work
- Always check_out or mark interrupted when done
- Put technical details in `context` field
- Log significant milestones
- Read existing tasks before creating new ones

**Don't:**
- Skip check_in/check_out
- Leave tasks in `in_progress` when stopping
- Create duplicate tasks
- Leave interrupted tasks without context

## CLAUDE.md Instructions

Copy this into your project's CLAUDE.md:

```markdown
## DevFlow Task Management

Use DevFlow MCP tools to track work:

1. CHECK IN before starting: `check_in(taskId, agentName, executionPlan)`
2. LOG progress: `log_activity(taskId, agentName, action, details)`
3. CHECK OUT when done: `check_out(taskId, agentName, summary)`
4. If blocked: `update_task(taskId, status: "interrupted", context: "...")`

Start sessions with: `list_tasks({ status: "todo" })`
```

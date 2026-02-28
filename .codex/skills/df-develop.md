<!-- DEVFLOW:BEGIN codex:skill:df-develop -->

# Skill: /df:develop

Use this skill to implement promoted Kanban tasks for a spec one at a time in Codex.

## Steps (in order)

1. Get spec name from the user if not provided.
2. Call `list_tasks` filtered by `specName`. Show the task list (title, status, priority).
   Confirm with the user before starting.
3. For each todo/backlog task in order:
   a. Call `check_in` with taskId and agentName — marks it `in_progress`.
   b. Read title, description, body (contains executionPlan) from the task.
   c. Implement the task. Run relevant tests.
   d. Call `check_out` with taskId, agentName, and a taskSummary
   (whatWasDone, filesChanged, issuesEncountered, followUps).
   e. Stop. Report: task title, what was done, files changed.
   Wait for explicit "continue" or "next" before the next task.
4. After all tasks done, call `get_spec_status` to confirm development is complete.

## Rules

- **Before starting any development**, call `get_spec_status` for the spec. If any artifact
  (proposal, specs, design, tasks) is not approved, tell the user which ones remain
  unapproved and stop. All artifacts must be approved before proceeding.
- Never check_in to more than one task at a time.
- If blocked, call `log_activity` with details and pause for human input.
- On failure, keep the task `in_progress` and report — do not check_out.
<!-- DEVFLOW:END codex:skill:df-develop -->

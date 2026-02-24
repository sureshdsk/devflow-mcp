<!-- DEVFLOW:BEGIN codex:skill:df-apply -->
# Skill: /df:apply

Use this skill to implement promoted tasks from the Kanban board one by one in Codex.

Required inputs (ask the user before calling any MCP tool):
- Spec name — which spec's tasks to implement (e.g. `add-oauth`)
- Project ID — the project the tasks belong to (run list_projects if unsure)

## Workflow

1. Call `list_tasks` filtered by `specName` and status `todo` or `backlog`.
2. Present the task list to the user and confirm before starting.
3. For each task, in order:
   a. Call `check_in` with the task ID — marks it `in_progress`.
   b. Read the task's `title`, `description`, `context`, and `executionPlan` fields.
   c. Implement the task (write code, update files, run tests as needed).
   d. Fill in the **Task Summary** section of that task card in `tasks.md` (completed, what was done, files changed, issues, follow-ups).
   e. Call `check_out` with the task ID and a short summary of what was done — marks it `done`.
   f. **Stop and report to the user before picking up the next task.**
      - Show: task title, what was done, files changed.
      - Wait for explicit "continue" or "next" before proceeding.
4. After all tasks are done, call `get_spec_status` to confirm the spec is complete.

## Rules
- Never check in to more than one task at a time.
- If a task is blocked or unclear, call `log_activity` with the blocker details and pause for human input.
- Do not skip tasks or reorder them without asking the user.
- If implementation fails, keep the task `in_progress` and report the error — do not check out.
<!-- DEVFLOW:END codex:skill:df-apply -->

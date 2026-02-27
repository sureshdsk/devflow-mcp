<!-- DEVFLOW:BEGIN codex:skill:df-continue -->
# Skill: /df:continue

Use this skill to write the next unblocked artifact in the spec DAG in Codex.

## Steps (in order)

1. Get spec name from user, or call `list_specs` and pick the most recent
   in-progress spec.
2. Call `get_spec_status` to see the current state.
3. Find the first artifact that is "ready" (predecessors approved, not yet done).
   DAG order: proposal → specs → design → tasks
4. Call `get_artifact_template` for that artifact type, then `write_artifact`
   with complete, non-placeholder content.
   - For "tasks": every task must use the `## Task: <title>` heading format.
   - After writing, call `validate_spec` and fix any ERROR or WARNING findings
     before stopping.
5. Stop. Tell the user which artifact was written and where to approve it
   (DevFlow UI /specs/<name> or `approve_artifact` MCP tool).
   If all artifacts are "done", tell the user to run /df:promote.

Review gate: Never advance to the next artifact until `get_spec_status` confirms
the current one is "done".
<!-- DEVFLOW:END codex:skill:df-continue -->

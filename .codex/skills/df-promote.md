<!-- DEVFLOW:BEGIN codex:skill:df-promote -->

# Skill: /df:promote

Use this skill to promote a fully approved spec to Kanban tasks in Codex.

## Steps

1. Get spec name from user, or call `list_specs`.
2. Call `get_spec_status` — confirm all artifacts (proposal, specs, design, tasks)
   are "done". If any are not approved, tell the user which ones remain and stop.
3. Call `promote_spec` with the spec name.
4. Report how many tasks were created and in which project.
<!-- DEVFLOW:END codex:skill:df-promote -->

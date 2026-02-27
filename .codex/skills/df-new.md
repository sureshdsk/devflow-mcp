<!-- DEVFLOW:BEGIN codex:skill:df-new -->

# Skill: /df:new

Use this skill to start a new spec from scratch in Codex.

## Steps (in order)

1. Resolve project: call `list_projects`. Pick the most relevant project or
   call `get_or_create_project` using the repo/directory name as default.
   A projectId is required before `create_spec`.
2. Get spec name (kebab-case, e.g. "add-oauth") and title from the user
   if not already provided.
3. Call `create_spec` with name, title, projectId.
4. Call `get_artifact_template` for "proposal", then `write_artifact` with a
   complete, well-structured proposal. No placeholder text.
5. Stop. Tell the user: "Review and approve the proposal in the DevFlow UI
   at /specs/<name> or via `approve_artifact`, then run /df:continue."

Review gate: Never write the next artifact until `get_spec_status` shows the
current one is "done".

<!-- DEVFLOW:END codex:skill:df-new -->

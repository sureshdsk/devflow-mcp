<!-- DEVFLOW:BEGIN codex:skill:df-new -->
# Skill: /df:new

Use this skill for the `/df:new` workflow action in Codex.
Creates a new spec folder and writes the proposal artifact for human review.

Required inputs (resolve in this order before calling any MCP tool):
1. Project: run list_projects to find existing projects.
   - If projects exist, use the most appropriate one or ask the user.
   - If none exist, use get_or_create_project with the repo/directory name
     as the default project name (slugified), or ask the user to confirm.
   A project MUST be resolved before create_spec is called.
2. Spec name: short kebab-case identifier (e.g. "add-oauth", "fix-login-bug")
3. Title: human-readable title for the spec
If not provided in the command, ask for them now before proceeding.

Mandatory review gate:
1. Enforce artifact order: proposal -> specs/design -> tasks.
2. After writing an artifact, stop and wait for human approval via the DevFlow UI or approve_artifact MCP tool.
3. Do not proceed to dependent artifacts until the current one is approved.
4. If an approved artifact is edited, treat it as draft and require re-approval before continuing.
<!-- DEVFLOW:END codex:skill:df-new -->

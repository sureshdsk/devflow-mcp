<!-- DEVFLOW:BEGIN codex:skill:df-status -->
# Skill: /df:status

Use this skill for the `/df:status` workflow action in Codex.
Shows the DAG status for a spec: what is approved, what is next, what is blocked.

Required inputs (ask the user before calling any MCP tool):
- Spec name: which spec to check (run list_specs if unsure)
If not provided in the command, ask for it now before proceeding.

Mandatory review gate:
1. Enforce artifact order: proposal -> specs/design -> tasks.
2. After writing an artifact, stop and wait for human approval via the DevFlow UI or approve_artifact MCP tool.
3. Do not proceed to dependent artifacts until the current one is approved.
4. If an approved artifact is edited, treat it as draft and require re-approval before continuing.
<!-- DEVFLOW:END codex:skill:df-status -->

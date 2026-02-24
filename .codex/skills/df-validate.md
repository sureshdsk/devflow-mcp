<!-- DEVFLOW:BEGIN codex:skill:df-validate -->
# Skill: /df:validate

Use this skill for the `/df:validate` workflow action in Codex.
Runs validation checks on spec completeness and quality, returning findings with codes and severity.

Required inputs (ask the user before calling any MCP tool):
- Spec name: which spec to validate (run list_specs if unsure)
If not provided in the command, ask for it now before proceeding.

Mandatory review gate:
1. Enforce artifact order: proposal -> specs/design -> tasks.
2. After writing an artifact, stop and wait for human approval via the DevFlow UI or approve_artifact MCP tool.
3. Do not proceed to dependent artifacts until the current one is approved.
4. If an approved artifact is edited, treat it as draft and require re-approval before continuing.
<!-- DEVFLOW:END codex:skill:df-validate -->

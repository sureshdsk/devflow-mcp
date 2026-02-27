<!-- DEVFLOW:BEGIN codex:skill:df-status -->

# Skill: /df:status

Use this skill to show the current DAG state for a spec in Codex.

## Steps

1. Get spec name from user, or call `list_specs`.
2. Call `get_spec_status`.
3. Output a structured summary:
   - Each artifact: name, state (blocked/ready/in_review/done), approved by/when if done
   - Current bottleneck: which artifact needs action and what that action is
   - Suggested next command: /df:continue, /df:promote, or /df:develop
   <!-- DEVFLOW:END codex:skill:df-status -->

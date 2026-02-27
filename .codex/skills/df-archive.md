<!-- DEVFLOW:BEGIN codex:skill:df-archive -->

# Skill: /df:archive

Use this skill to archive a completed or abandoned spec in Codex.

## Steps

1. Get spec name from user, or call `list_specs`.
2. Call `get_spec_status`. Warn if any tasks are still `in_progress`.
3. Confirm with the user before archiving.
4. Call `archive_spec`.
5. Report success and the archive path.
<!-- DEVFLOW:END codex:skill:df-archive -->

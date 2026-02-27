<!-- DEVFLOW:BEGIN codex:skill:df-schema -->

# Skill: /df:schema

Use this skill to interactively create a custom DevFlow schema in Codex.

## Steps (in order)

1. Call `list_schemas` and show the user what schemas are already available.
   If one fits their needs, suggest using it directly.
2. Ask what kind of project/workflow they need (e.g. mobile app, ML pipeline,
   infrastructure, documentation, data engineering, security review, etc.).
3. Based on the project type, ask which artifacts/documents their workflow
   should include. Suggest sensible defaults. Common options:
   - Proposal / RFC
   - Requirements / Specifications
   - Architecture / Design doc
   - Security review
   - Testing plan / Test strategy
   - Migration plan
   - Deployment / Runbook
   - Implementation tasks
4. Design the artifact dependency DAG — which artifacts must be approved
   before others can be written. Present the DAG to the user for confirmation.
5. Ask about quality rules:
   - RFC 2119 keywords enforced (MUST/SHOULD/MAY)?
   - Minimum scenarios per requirement (suggest 1-2)?
6. Generate well-structured markdown templates for each artifact.
7. Call `create_schema` with name, artifacts, qualityRules, apply, and templates.
8. Report the schema was created and how to use it:
   - `create_spec` with `schema: "<name>"`
   - Or set as default in `devflow/project-config.json`

## Guidelines

- Keep artifact IDs short and kebab-case (e.g. "security-review", "test-plan")
- Template filenames should match: `<artifact-id>.md`
- Always include a final "tasks" artifact that depends on the key artifacts
- The `apply.requires` should include at minimum the tasks artifact
<!-- DEVFLOW:END codex:skill:df-schema -->

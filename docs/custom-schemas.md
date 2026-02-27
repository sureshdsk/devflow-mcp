# Custom Schemas

Schemas define the artifact workflow for a spec — which documents are required,
their dependencies, and quality rules.

## Built-in Schemas

DevFlow ships with several schemas: `spec-driven`, `backend-api`,
`frontend-product`, `data-engineering`, and `devops-platform`. List them with
the `list_schemas` MCP tool.

## Creating a Custom Schema

### Using `/df:schema` (recommended)

Run the `/df:df-schema` skill in Claude Code. It will interactively ask about
your project type, workflow stages, and quality preferences, then create the
schema files for you.

### Manual Creation

Create a directory under `devflow/schemas/<name>/` with:

```
devflow/schemas/my-schema/
├── schema.yaml
└── templates/
    ├── proposal.md
    ├── design.md
    └── tasks.md
```

### schema.yaml Structure

```yaml
name: my-schema # Must match directory name
version: 1
artifacts:
  - id: proposal # Unique identifier
    generates: proposal.md
    description: Change intent and scope
    template: proposal.md # File in templates/ dir
    requires: [] # No dependencies — this is a root artifact
  - id: design
    generates: design.md
    description: Technical approach
    template: design.md
    requires: [proposal] # Blocked until proposal is approved
  - id: tasks
    generates: tasks.md
    description: Implementation tasks
    template: tasks.md
    requires: [design]
qualityRules:
  requireRfc2119: true # Enforce MUST/SHOULD/MAY keywords
  minScenariosPerRequirement: 1 # Min test scenarios per requirement
apply:
  requires: [tasks] # Which artifacts gate promotion to Kanban tasks
```

### Key Concepts

- **Artifact DAG**: Artifacts form a directed acyclic graph via `requires`.
  An artifact is "blocked" until all its dependencies are approved.
- **Quality rules**: Optional enforcement of RFC 2119 language and scenario
  coverage in specs.
- **Apply gate**: The `apply.requires` field controls which artifacts must be
  approved before a spec can be promoted to Kanban tasks via `promote_spec`.

### Using the `create_schema` MCP Tool

You can also create schemas programmatically:

```
create_schema({
  name: "ml-pipeline",
  artifacts: [
    { id: "proposal", generates: "proposal.md", description: "Problem statement", template: "proposal.md", requires: [] },
    { id: "data-spec", generates: "data-spec.md", description: "Data requirements", template: "data-spec.md", requires: ["proposal"] },
    { id: "model-design", generates: "model-design.md", description: "Model architecture", template: "model-design.md", requires: ["data-spec"] },
    { id: "tasks", generates: "tasks.md", description: "Implementation tasks", template: "tasks.md", requires: ["model-design"] }
  ],
  qualityRules: { requireRfc2119: true },
  apply: { requires: ["tasks"] },
  templates: {
    "proposal": "# Proposal\n\n## Problem Statement\n...",
    "data-spec": "# Data Specification\n\n## Sources\n...",
    "model-design": "# Model Design\n\n## Architecture\n...",
    "tasks": "# Tasks\n\n- [ ] Task 1\n..."
  }
})
```

## Project-local vs Bundled Schemas

- **Bundled**: Ship with DevFlow in `src/schemas/`. Cannot be modified by users.
- **Project-local**: Live in `devflow/schemas/`. Override bundled schemas if
  names conflict. Created by `create_schema` or `/df:df-schema`.

## Template Authoring Tips

- Use clear section headers that guide the author
- Include HTML comments (`<!-- ... -->`) with instructions
- Reference the artifact's purpose from `schema.yaml` description
- Keep templates focused — each artifact should have a single responsibility

## Setting a Default Schema

Create or edit `devflow/project-config.json`:

```json
{
  "defaultSchema": "my-schema"
}
```

New specs created without an explicit `schema` parameter will use this schema.

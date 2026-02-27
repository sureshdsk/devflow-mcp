# Tasks: [Title]

<!-- List implementation tasks using the format below -->
<!-- Tasks will be parsed and promoted to the Kanban board -->

## How To Use This File

- Create one task card per meaningful unit of delivery.
- Keep tasks dependency-ordered and independently executable where possible.
- Every task card must include enough context that a new agent can execute it without re-discovery work.
- Replace all placeholders before implementation starts.

## 1. Delivery Overview

### 1.1 Objective

<One-paragraph summary of what this change delivers and why it matters.>

### 1.2 In-Scope Outcomes

- <Outcome 1>
- <Outcome 2>

### 1.3 Non-Goals

- <Non-goal 1>
- <Non-goal 2>

### 1.4 Global Constraints

- <Technical or product constraints that apply to all tasks>
- <Compatibility/performance/security constraints>

### 1.5 Shared References

- Proposal: `specflow/changes/<change-name>/proposal.md`
- Design: `specflow/changes/<change-name>/design.md`
- Specs: `specflow/changes/<change-name>/specs/spec.md`
- Additional docs/code:
  - `<path-or-doc-1>`
  - `<path-or-doc-2>`

## 2. Task Cards

### 2.1 Task: <short-task-title>

- [ ] **Status**
- **Task ID:** `<T1>`
- **Owner Type:** `<agent|human|either>`
- **Priority:** `<P0|P1|P2>`
- **Depends On:** `<none|T0,...>`

**Goal**
<What this task must accomplish in concrete terms.>

**Context**
<Domain and technical context required before editing. Include key assumptions.>

**Scope**

- In scope:
  - <item>
  - <item>
- Out of scope:
  - <item>

**Implementation Targets**

- Files to create/update:
  - `<path>`
  - `<path>`
- Public interfaces or contracts affected:
  - `<API/type/command>`

**Execution Steps**

1. <Step 1 with expected output>
2. <Step 2 with expected output>
3. <Step 3 with expected output>

**Validation**

- Automated tests to add/update:
  - `<test file>`
- Commands to run:
  - `<command>`
  - `<command>`
- Manual checks:
  - <check>

**Acceptance Criteria**

- <Measurable criterion 1>
- <Measurable criterion 2>

**Risks and Mitigations**

- Risk: <risk>
  - Mitigation: <mitigation>

**Handoff Notes**
<What the next task/agent should know, including outputs and unresolved items.>

**Task Summary**

<!-- To be filled by the agent after completing this task -->

- Completed: <!-- yes/no -->
- What was done: <!-- brief description -->
- Files changed: <!-- list key files -->
- Issues encountered: <!-- any blockers, surprises, or deviations from the plan -->
- Follow-ups: <!-- items deferred or discovered during implementation -->

### 2.2 Task: <short-task-title>

- [ ] **Status**
- **Task ID:** `<T2>`
- **Owner Type:** `<agent|human|either>`
- **Priority:** `<P0|P1|P2>`
- **Depends On:** `<none|T1,...>`

**Goal**
<What this task must accomplish in concrete terms.>

**Context**
<Domain and technical context required before editing. Include key assumptions.>

**Scope**

- In scope:
  - <item>
  - <item>
- Out of scope:
  - <item>

**Implementation Targets**

- Files to create/update:
  - `<path>`
  - `<path>`
- Public interfaces or contracts affected:
  - `<API/type/command>`

**Execution Steps**

1. <Step 1 with expected output>
2. <Step 2 with expected output>
3. <Step 3 with expected output>

**Validation**

- Automated tests to add/update:
  - `<test file>`
- Commands to run:
  - `<command>`
  - `<command>`
- Manual checks:
  - <check>

**Acceptance Criteria**

- <Measurable criterion 1>
- <Measurable criterion 2>

**Risks and Mitigations**

- Risk: <risk>
  - Mitigation: <mitigation>

**Handoff Notes**
<What the next task/agent should know, including outputs and unresolved items.>

**Task Summary**

<!-- To be filled by the agent after completing this task -->

- Completed: <!-- yes/no -->
- What was done: <!-- brief description -->
- Files changed: <!-- list key files -->
- Issues encountered: <!-- any blockers, surprises, or deviations from the plan -->
- Follow-ups: <!-- items deferred or discovered during implementation -->

## 3. Cross-Task Verification

- [ ] End-to-end behavior matches `specs/spec.md` requirements and scenarios.
- [ ] All affected tests are updated and passing.
- [ ] User-facing docs and command help are updated where behavior changed.
- [ ] Rollback path is documented for risky changes.

## 4. Completion Gate

- [ ] All task cards are checked complete.
- [ ] `node bin/specflow.js validate --change <change-name>` passes.
- [ ] Implementation summary and follow-up items are recorded in handoff notes.

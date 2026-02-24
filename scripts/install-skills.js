#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const {
  parseTools,
  getToolAdapter,
  detectEnvironments,
} = require('./install-environments');

const MANAGED_BEGIN = '<!-- DEVFLOW:BEGIN ';
const MANAGED_END = '<!-- DEVFLOW:END ';
const COMMAND_SET = ['new', 'continue', 'status', 'validate', 'promote', 'apply', 'archive'];

function resolveToolDirs(projectRoot, tool) {
  return getToolAdapter(tool).resolveTargets(projectRoot);
}

function managedBlock(markerId, body) {
  return `${MANAGED_BEGIN}${markerId} -->\n${body}\n${MANAGED_END}${markerId} -->\n`;
}

function renderSkill(tool, command, markerId) {
  if (command === 'apply') {
    const agentName = tool === 'codex' ? 'Codex' : 'Claude Code';
    const body = [
      `# Skill: /df:apply`,
      '',
      `Use this skill to implement promoted tasks from the Kanban board one by one in ${agentName}.`,
      '',
      'Required inputs (ask the user before calling any MCP tool):',
      '- Spec name — which spec\'s tasks to implement (e.g. `add-oauth`)',
      '- Project ID — the project the tasks belong to (run list_projects if unsure)',
      '',
      '## Workflow',
      '',
      '1. Call `list_tasks` filtered by `specName` and status `todo` or `backlog`.',
      '2. Present the task list to the user and confirm before starting.',
      '3. For each task, in order:',
      '   a. Call `check_in` with the task ID — marks it `in_progress`.',
      '   b. Read the task\'s `title`, `description`, `context`, and `executionPlan` fields.',
      '   c. Implement the task (write code, update files, run tests as needed).',
      '   d. Fill in the **Task Summary** section of that task card in `tasks.md` (completed, what was done, files changed, issues, follow-ups).',
      '   e. Call `check_out` with the task ID and a short summary of what was done — marks it `done`.',
      '   f. **Stop and report to the user before picking up the next task.**',
      '      - Show: task title, what was done, files changed.',
      '      - Wait for explicit "continue" or "next" before proceeding.',
      '4. After all tasks are done, call `get_spec_status` to confirm the spec is complete.',
      '',
      '## Rules',
      '- Never check in to more than one task at a time.',
      '- If a task is blocked or unclear, call `log_activity` with the blocker details and pause for human input.',
      '- Do not skip tasks or reorder them without asking the user.',
      '- If implementation fails, keep the task `in_progress` and report the error — do not check out.',
    ].join('\n');
    return managedBlock(markerId, body);
  }

  const descriptions = {
    new: 'Creates a new spec folder and writes the proposal artifact for human review.',
    continue: 'Continues the active spec by writing the next unblocked artifact and stopping for human review.',
    status: 'Shows the DAG status for a spec: what is approved, what is next, what is blocked.',
    validate: 'Runs validation checks on spec completeness and quality, returning findings with codes and severity.',
    promote: 'Promotes a fully approved spec to Kanban tasks in the database. All four artifacts must be approved first.',
    archive: 'Archives a completed spec by moving its folder to devflow/specs/archive/.',
  };
  const inputs = {
    new: [
      '',
      'Required inputs (resolve in this order before calling any MCP tool):',
      '1. Project: run list_projects to find existing projects.',
      '   - If projects exist, use the most appropriate one or ask the user.',
      '   - If none exist, use get_or_create_project with the repo/directory name',
      '     as the default project name (slugified), or ask the user to confirm.',
      '   A project MUST be resolved before create_spec is called.',
      '2. Spec name: short kebab-case identifier (e.g. "add-oauth", "fix-login-bug")',
      '3. Title: human-readable title for the spec',
      'If not provided in the command, ask for them now before proceeding.',
    ],
    continue: [
      '',
      'Required inputs (ask the user before calling any MCP tool):',
      '- Spec name: which spec to continue (run list_specs if unsure)',
      'If not provided in the command, ask for it now before proceeding.',
    ],
    status: [
      '',
      'Required inputs (ask the user before calling any MCP tool):',
      '- Spec name: which spec to check (run list_specs if unsure)',
      'If not provided in the command, ask for it now before proceeding.',
    ],
    validate: [
      '',
      'Required inputs (ask the user before calling any MCP tool):',
      '- Spec name: which spec to validate (run list_specs if unsure)',
      'If not provided in the command, ask for it now before proceeding.',
    ],
    promote: [
      '',
      'Required inputs (ask the user before calling any MCP tool):',
      '- Spec name: which spec to promote',
      'The project is read automatically from the spec\'s metadata — no need to supply a project ID.',
      'If not provided in the command, ask for it now before proceeding.',
    ],
    archive: [
      '',
      'Required inputs (ask the user before calling any MCP tool):',
      '- Spec name: which spec to archive',
      'If not provided in the command, ask for it now before proceeding.',
    ],
  };
  const body = [
    `# Skill: /df:${command}`,
    '',
    `Use this skill for the \`/df:${command}\` workflow action in ${tool === 'codex' ? 'Codex' : 'Claude Code'}.`,
    descriptions[command] || '',
    ...(inputs[command] || []),
    '',
    'Mandatory review gate:',
    '1. Enforce artifact order: proposal -> specs/design -> tasks.',
    '2. After writing an artifact, stop and wait for human approval via the DevFlow UI or approve_artifact MCP tool.',
    '3. Do not proceed to dependent artifacts until the current one is approved.',
    '4. If an approved artifact is edited, treat it as draft and require re-approval before continuing.',
  ].join('\n');
  return managedBlock(markerId, body);
}

function renderCommand(tool, command, markerId) {
  const commandName = `/df:${command}`;

  if (command === 'apply') {
    const lines = [];
    if (tool === 'codex') {
      lines.push('---', `description: DevFlow ${commandName} workflow action`, '---', '');
    }
    lines.push(
      `# ${commandName}`,
      '',
      'Implement promoted tasks from the Kanban board one by one.',
      '',
      '## Required inputs',
      'Ask the user before calling any MCP tool if not already provided:',
      '- **Spec name** — which spec\'s tasks to implement (e.g. `add-oauth`)',
      '- **Project ID** — the project the tasks belong to',
      '',
      '## Workflow',
      '',
      '1. Call `list_tasks` filtered by `specName` and status `todo` or `backlog`.',
      '2. Present the task list to the user and confirm before starting.',
      '3. For each task, in order:',
      '   a. Call `check_in` with the task ID — this marks it `in_progress`.',
      '   b. Read the task\'s `title`, `description`, `context`, and `executionPlan` fields.',
      '   c. Implement the task (write code, update files, run tests as needed).',
      '   d. Fill in the **Task Summary** section of that task card in `tasks.md` (completed, what was done, files changed, issues, follow-ups).',
      '   e. Call `check_out` with the task ID and a short summary of what was done — this marks it `done`.',
      '   f. **Stop and report to the user before picking up the next task.**',
      '      - Show: task title, what was done, files changed.',
      '      - Wait for explicit "continue" or "next" before proceeding.',
      '4. After all tasks are done, call `get_spec_status` to confirm the spec is complete.',
      '',
      '## Rules',
      '- Never check in to more than one task at a time.',
      '- If a task is blocked or unclear, call `log_activity` with the blocker details and pause for human input.',
      '- Do not skip tasks or reorder them without asking the user.',
      '- If implementation fails, keep the task `in_progress` and report the error — do not check out.',
    );
    return managedBlock(markerId, lines.join('\n'));
  }

  const descriptions = {
    new: 'Creates a new spec folder and writes the proposal artifact for human review.\n\nRequired inputs (resolve in this order before calling any MCP tool):\n1. Project: run list_projects to find existing projects.\n   - If projects exist, use the most appropriate one or ask the user.\n   - If none exist, use get_or_create_project with the repo/directory name as the default.\n   A project MUST be resolved before create_spec is called.\n2. Spec name (kebab-case)\n3. Title',
    continue: 'Continues the active spec by writing the next unblocked artifact and stopping for human review.\n\nAsk the user for the spec name before calling any MCP tool. Run list_specs if unsure.',
    status: 'Shows the DAG status for a spec.\n\nAsk the user for the spec name before calling any MCP tool. Run list_specs if unsure.',
    validate: 'Runs validation checks on spec completeness and quality.\n\nAsk the user for the spec name before calling any MCP tool. Run list_specs if unsure.',
    promote: 'Promotes a fully approved spec to Kanban tasks in the database.\n\nAsk the user for the spec name before calling any MCP tool. The project is read automatically from the spec\'s metadata — no project ID needed.',
    archive: 'Archives a completed spec by moving its folder to devflow/specs/archive/.\n\nAsk the user for the spec name before calling any MCP tool. Run list_specs if unsure.',
  };
  const lines = [];
  if (tool === 'codex') {
    lines.push('---', `description: DevFlow ${commandName} workflow action`, '---', '');
  }
  lines.push(
    `# ${commandName}`,
    '',
    `Run the DevFlow "${command}" workflow action.`,
    descriptions[command] || '',
    '',
    'Mandatory review gate:',
    '- Enforce proposal -> specs/design -> tasks ordering.',
    '- Pause for human review after each artifact write.',
    '- Continue only after explicit approve_artifact for the current phase.',
  );
  return managedBlock(markerId, lines.join('\n'));
}

function replaceManagedSection(existing, markerId, nextContent) {
  const escaped = markerId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<!-- DEVFLOW:BEGIN ${escaped} -->[\\s\\S]*?<!-- DEVFLOW:END ${escaped} -->\\n?`,
    'm'
  );
  if (!pattern.test(existing)) return null;
  return existing.replace(pattern, nextContent);
}

function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function buildAssets(projectRoot, tools, delivery) {
  const assets = [];
  for (const tool of tools) {
    const dirs = resolveToolDirs(projectRoot, tool);
    for (const command of COMMAND_SET) {
      const skillMarker = `${tool}:skill:df-${command}`;
      const commandMarker = `${tool}:command:df-${command}`;
      if (delivery !== 'commands') {
        assets.push({
          tool, kind: 'skill', command,
          outputPath: path.join(dirs.skillsDir, `df-${command}.md`),
          markerId: skillMarker,
          content: renderSkill(tool, command, skillMarker),
        });
      }
      if (delivery !== 'skills') {
        assets.push({
          tool, kind: 'command', command,
          outputPath: path.join(dirs.commandsDir, `df-${command}.md`),
          markerId: commandMarker,
          content: renderCommand(tool, command, commandMarker),
        });
      }
    }
  }
  return assets;
}

function selectTools(projectRoot, options) {
  const autodetect = options.autodetect !== false;
  const detection = detectEnvironments(projectRoot, options.detectionOverrides);
  let selectedTools;

  if (options.only) {
    selectedTools = parseTools(options.only);
  } else if (options.tools !== undefined) {
    selectedTools = parseTools(options.tools);
  } else if (autodetect) {
    selectedTools = detection.filter(d => d.detected).map(d => d.id);
  } else {
    selectedTools = parseTools('all');
  }

  return {
    autodetect,
    detection,
    selectedTools,
  };
}

function installSkills(projectRoot, options = {}) {
  const delivery = options.delivery ?? 'both';
  const dryRun = Boolean(options.dryRun);
  const selection = selectTools(projectRoot, options);
  const report = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    results: [],
    dryRun,
    autodetect: selection.autodetect,
    selectedTools: selection.selectedTools,
    environments: selection.detection.map(d => ({
      tool: d.id,
      detected: d.detected,
      status: selection.selectedTools.includes(d.id)
        ? (dryRun ? 'planned' : 'pending')
        : 'skipped',
      reason: selection.selectedTools.includes(d.id)
        ? undefined
        : (selection.autodetect && options.tools === undefined && !options.only
          ? (d.detected ? 'not-selected' : 'not-detected')
          : 'not-selected'),
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    })),
  };

  if (selection.selectedTools.length === 0) return report;

  const assets = buildAssets(projectRoot, selection.selectedTools, delivery);

  for (const asset of assets) {
    const { outputPath, markerId, content, tool } = asset;
    const envReport = report.environments.find(e => e.tool === tool);
    const displayPath = path.relative(projectRoot, outputPath);
    try {
      const alreadyExists = exists(outputPath);
      if (alreadyExists) {
        const existing = fs.readFileSync(outputPath, 'utf-8');
        const replaced = replaceManagedSection(existing, markerId, content);

        if (replaced !== null) {
          if (replaced !== existing) {
            if (!dryRun) {
              writeFileAtomic(outputPath, replaced);
            }
            report.updated++;
            if (envReport) envReport.updated++;
            report.results.push({ ...asset, path: displayPath, action: dryRun ? 'would_update' : 'updated' });
          } else {
            report.skipped++;
            if (envReport) envReport.skipped++;
            report.results.push({ ...asset, path: displayPath, action: 'skipped' });
          }
          continue;
        }

        const ownershipError = new Error(
          `Refusing to modify unmanaged file for ${tool}: ${displayPath}`
        );
        ownershipError.code = 'UNMANAGED_FILE';
        throw ownershipError;
      }

      if (!dryRun) {
        writeFileAtomic(outputPath, content);
      }
      report.created++;
      if (envReport) envReport.created++;
      report.results.push({ ...asset, path: displayPath, action: dryRun ? 'would_create' : 'created' });
    } catch (error) {
      report.failed++;
      if (envReport) envReport.failed++;
      report.results.push({
        ...asset,
        path: displayPath,
        action: 'failed',
        errorCode: error && typeof error === 'object' && 'code' in error ? error.code : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const envReport of report.environments) {
    if (!selection.selectedTools.includes(envReport.tool)) continue;
    if (envReport.failed > 0) {
      envReport.status = 'failed';
      envReport.reason = envReport.created + envReport.updated > 0 ? 'partial-failure' : 'install-failed';
    } else if (dryRun) {
      envReport.status = 'planned';
    } else {
      envReport.status = 'installed';
    }
  }

  return report;
}

function printReport(report) {
  if (report.environments && report.environments.length > 0) {
    console.log('\nEnvironment summary:');
    for (const env of report.environments) {
      const statusDetails = env.reason ? `${env.status} (${env.reason})` : env.status;
      const detectedText = env.detected ? 'detected' : 'not detected';
      console.log(`  - ${env.tool}: ${statusDetails}; ${detectedText}; created=${env.created} updated=${env.updated} skipped=${env.skipped} failed=${env.failed}`);
    }
    console.log('');
  }

  for (const r of report.results) {
    const icon =
      r.action === 'created' || r.action === 'would_create' ? '✓' :
      r.action === 'updated' || r.action === 'would_update' ? '↻' :
      r.action === 'failed' ? '✗' :
      '–';
    const errorSuffix = r.action === 'failed' ? ` - ${r.error}` : '';
    console.log(`  ${icon} [${r.tool}] ${r.kind} ${r.path} (${r.action})${errorSuffix}`);
  }
  const mode = report.dryRun ? ' (dry-run)' : '';
  console.log(`\n  ${report.created} created, ${report.updated} updated, ${report.skipped} skipped, ${report.failed} failed${mode}`);
}

// CLI usage: node scripts/install-skills.js [--tools all|codex|claudecode] [--delivery both|skills|commands] [--force]
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tools') options.tools = args[++i];
    else if (args[i] === '--only') options.only = args[++i];
    else if (args[i] === '--no-autodetect') options.autodetect = false;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else if (args[i] === '--delivery') options.delivery = args[++i];
    else if (args[i] === '--force') options.force = true;
  }
  const projectRoot = process.cwd();
  console.log('Installing DevFlow skills and slash commands...');
  const report = installSkills(projectRoot, options);
  printReport(report);
}

module.exports = { installSkills, printReport, buildAssets, replaceManagedSection, selectTools };

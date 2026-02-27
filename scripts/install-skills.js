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
const COMMAND_SET = ['new', 'continue', 'status', 'promote', 'develop', 'archive'];

function resolveToolDirs(projectRoot, tool) {
  return getToolAdapter(tool).resolveTargets(projectRoot);
}

function managedBlock(markerId, body) {
  return `${MANAGED_BEGIN}${markerId} -->\n${body}\n${MANAGED_END}${markerId} -->\n`;
}

function renderSkill(tool, command, markerId) {
  const agentName = tool === 'codex' ? 'Codex' : 'Claude Code';

  if (command === 'develop') {
    const body = [
      `# Skill: /df:develop`,
      '',
      `Use this skill to implement promoted Kanban tasks for a spec one at a time in ${agentName}.`,
      '',
      '## Steps (in order)',
      '',
      '1. Get spec name from the user if not provided.',
      '2. Call `list_tasks` filtered by `specName`. Show the task list (title, status, priority).',
      '   Confirm with the user before starting.',
      '3. For each todo/backlog task in order:',
      '   a. Call `check_in` with taskId and agentName — marks it `in_progress`.',
      '   b. Read title, description, body (contains executionPlan) from the task.',
      '   c. Implement the task. Run relevant tests.',
      '   d. Call `check_out` with taskId, agentName, and a taskSummary',
      '      (whatWasDone, filesChanged, issuesEncountered, followUps).',
      '   e. Stop. Report: task title, what was done, files changed.',
      '      Wait for explicit "continue" or "next" before the next task.',
      '4. After all tasks done, call `get_spec_status` to confirm development is complete.',
      '',
      '## Rules',
      '- Never check_in to more than one task at a time.',
      '- If blocked, call `log_activity` with details and pause for human input.',
      '- On failure, keep the task `in_progress` and report — do not check_out.',
    ].join('\n');
    return managedBlock(markerId, body);
  }

  const bodies = {
    new: [
      `# Skill: /df:new`,
      '',
      `Use this skill to start a new spec from scratch in ${agentName}.`,
      '',
      '## Steps (in order)',
      '',
      '1. Resolve project: call `list_projects`. Pick the most relevant project or',
      '   call `get_or_create_project` using the repo/directory name as default.',
      '   A projectId is required before `create_spec`.',
      '2. Get spec name (kebab-case, e.g. "add-oauth") and title from the user',
      '   if not already provided.',
      '3. Call `create_spec` with name, title, projectId.',
      '4. Call `get_artifact_template` for "proposal", then `write_artifact` with a',
      '   complete, well-structured proposal. No placeholder text.',
      '5. Stop. Tell the user: "Review and approve the proposal in the DevFlow UI',
      '   at /specs/<name> or via `approve_artifact`, then run /df:continue."',
      '',
      'Review gate: Never write the next artifact until `get_spec_status` shows the',
      'current one is "done".',
    ],
    continue: [
      `# Skill: /df:continue`,
      '',
      `Use this skill to write the next unblocked artifact in the spec DAG in ${agentName}.`,
      '',
      '## Steps (in order)',
      '',
      '1. Get spec name from user, or call `list_specs` and pick the most recent',
      '   in-progress spec.',
      '2. Call `get_spec_status` to see the current state.',
      '3. Find the first artifact that is "ready" (predecessors approved, not yet done).',
      '   DAG order: proposal → specs → design → tasks',
      '4. Call `get_artifact_template` for that artifact type, then `write_artifact`',
      '   with complete, non-placeholder content.',
      '   - For "tasks": every task must use the `## Task: <title>` heading format.',
      '   - After writing, call `validate_spec` and fix any ERROR or WARNING findings',
      '     before stopping.',
      '5. Stop. Tell the user which artifact was written and where to approve it',
      '   (DevFlow UI /specs/<name> or `approve_artifact` MCP tool).',
      '   If all artifacts are "done", tell the user to run /df:promote.',
      '',
      'Review gate: Never advance to the next artifact until `get_spec_status` confirms',
      'the current one is "done".',
    ],
    status: [
      `# Skill: /df:status`,
      '',
      `Use this skill to show the current DAG state for a spec in ${agentName}.`,
      '',
      '## Steps',
      '',
      '1. Get spec name from user, or call `list_specs`.',
      '2. Call `get_spec_status`.',
      '3. Output a structured summary:',
      '   - Each artifact: name, state (blocked/ready/in_review/done), approved by/when if done',
      '   - Current bottleneck: which artifact needs action and what that action is',
      '   - Suggested next command: /df:continue, /df:promote, or /df:develop',
    ],
    promote: [
      `# Skill: /df:promote`,
      '',
      `Use this skill to promote a fully approved spec to Kanban tasks in ${agentName}.`,
      '',
      '## Steps',
      '',
      '1. Get spec name from user, or call `list_specs`.',
      '2. Call `get_spec_status` — confirm all artifacts (proposal, specs, design, tasks)',
      '   are "done". If any are not approved, tell the user which ones remain and stop.',
      '3. Call `promote_spec` with the spec name.',
      '4. Report how many tasks were created and in which project.',
    ],
    archive: [
      `# Skill: /df:archive`,
      '',
      `Use this skill to archive a completed or abandoned spec in ${agentName}.`,
      '',
      '## Steps',
      '',
      '1. Get spec name from user, or call `list_specs`.',
      '2. Call `get_spec_status`. Warn if any tasks are still `in_progress`.',
      '3. Confirm with the user before archiving.',
      '4. Call `archive_spec`.',
      '5. Report success and the archive path.',
    ],
  };

  const lines = bodies[command];
  if (!lines) return managedBlock(markerId, `# Skill: /df:${command}\n\nUnknown command.`);
  return managedBlock(markerId, lines.join('\n'));
}

function renderCommand(tool, command, markerId) {
  const commandName = `/df:${command}`;
  const codexHeader = tool === 'codex'
    ? ['---', `description: DevFlow ${commandName} workflow action`, '---', '']
    : [];

  const bodies = {
    new: [
      `# ${commandName}`,
      '',
      'Start a new spec from scratch.',
      '',
      '## Steps (in order)',
      '',
      '1. Resolve project: call `list_projects`. Pick the most relevant project or',
      '   call `get_or_create_project` using the repo/directory name as default.',
      '   A projectId is required before `create_spec`.',
      '2. Get spec name (kebab-case, e.g. "add-oauth") and title from the user',
      '   if not already provided.',
      '3. Call `create_spec` with name, title, projectId.',
      '4. Call `get_artifact_template` for "proposal", then `write_artifact` with a',
      '   complete, well-structured proposal. No placeholder text.',
      '5. Stop. Tell the user: "Review and approve the proposal in the DevFlow UI',
      '   at /specs/<name> or via `approve_artifact`, then run /df:continue."',
      '',
      'Review gate: Never write the next artifact until `get_spec_status` shows the',
      'current one is "done".',
    ],
    continue: [
      `# ${commandName}`,
      '',
      'Write the next unblocked artifact in the spec DAG.',
      '',
      '## Steps (in order)',
      '',
      '1. Get spec name from user, or call `list_specs` and pick the most recent',
      '   in-progress spec.',
      '2. Call `get_spec_status` to see the current state.',
      '3. Find the first artifact that is "ready" (predecessors approved, not yet done).',
      '   DAG order: proposal → specs → design → tasks',
      '4. Call `get_artifact_template` for that artifact type, then `write_artifact`',
      '   with complete, non-placeholder content.',
      '   - For "tasks": every task must use the `## Task: <title>` heading format.',
      '   - After writing, call `validate_spec` and fix any ERROR or WARNING findings',
      '     before stopping.',
      '5. Stop. Tell the user which artifact was written and where to approve it',
      '   (DevFlow UI /specs/<name> or `approve_artifact` MCP tool).',
      '   If all artifacts are "done", tell the user to run /df:promote.',
      '',
      'Review gate: Never advance to the next artifact until `get_spec_status` confirms',
      'the current one is "done".',
    ],
    status: [
      `# ${commandName}`,
      '',
      'Show the current DAG state for a spec.',
      '',
      '## Steps',
      '',
      '1. Get spec name from user, or call `list_specs`.',
      '2. Call `get_spec_status`.',
      '3. Output a structured summary:',
      '   - Each artifact: name, state (blocked/ready/in_review/done), approved by/when if done',
      '   - Current bottleneck: which artifact needs action and what that action is',
      '   - Suggested next command: /df:continue, /df:promote, or /df:develop',
    ],
    promote: [
      `# ${commandName}`,
      '',
      'Promote a fully approved spec to Kanban tasks.',
      '',
      '## Steps',
      '',
      '1. Get spec name from user, or call `list_specs`.',
      '2. Call `get_spec_status` — confirm all artifacts (proposal, specs, design, tasks)',
      '   are "done". If any are not approved, tell the user which ones remain and stop.',
      '3. Call `promote_spec` with the spec name.',
      '4. Report how many tasks were created and in which project.',
    ],
    develop: [
      `# ${commandName}`,
      '',
      'Implement promoted Kanban tasks for a spec one at a time.',
      '',
      '## Steps (in order)',
      '',
      '1. Get spec name from the user if not provided.',
      '2. Call `list_tasks` filtered by `specName`. Show the task list (title, status, priority).',
      '   Confirm with the user before starting.',
      '3. For each todo/backlog task in order:',
      '   a. Call `check_in` with taskId and agentName — marks it `in_progress`.',
      '   b. Read title, description, body (contains executionPlan) from the task.',
      '   c. Implement the task. Run relevant tests.',
      '   d. Call `check_out` with taskId, agentName, and a taskSummary',
      '      (whatWasDone, filesChanged, issuesEncountered, followUps).',
      '   e. Stop. Report: task title, what was done, files changed.',
      '      Wait for explicit "continue" or "next" before the next task.',
      '4. After all tasks done, call `get_spec_status` to confirm development is complete.',
      '',
      '## Rules',
      '- Never check_in to more than one task at a time.',
      '- If blocked, call `log_activity` with details and pause for human input.',
      '- On failure, keep the task `in_progress` and report — do not check_out.',
    ],
    archive: [
      `# ${commandName}`,
      '',
      'Archive a completed or abandoned spec.',
      '',
      '## Steps',
      '',
      '1. Get spec name from user, or call `list_specs`.',
      '2. Call `get_spec_status`. Warn if any tasks are still `in_progress`.',
      '3. Confirm with the user before archiving.',
      '4. Call `archive_spec`.',
      '5. Report success and the archive path.',
    ],
  };

  const bodyLines = bodies[command];
  if (!bodyLines) return managedBlock(markerId, `# ${commandName}\n\nUnknown command.`);
  return managedBlock(markerId, [...codexHeader, ...bodyLines].join('\n'));
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

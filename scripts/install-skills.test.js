const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const { installSkills } = require('./install-skills');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-install-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function withCodexHome(tempProject, fn) {
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = path.join(tempProject, 'codex-home');
  try {
    return fn(process.env.CODEX_HOME);
  } finally {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
  }
}

test('installer is idempotent on re-run for managed assets', () => {
  const projectRoot = makeTempProject();
  try {
    withCodexHome(projectRoot, () => {
      const first = installSkills(projectRoot, { tools: 'codex', delivery: 'both' });
      assert.equal(first.failed, 0);
      assert.ok(first.created > 0);

      const second = installSkills(projectRoot, { tools: 'codex', delivery: 'both' });
      assert.equal(second.failed, 0);
      assert.equal(second.created, 0);
      assert.equal(second.updated, 0);
      assert.ok(second.skipped > 0);
    });
  } finally {
    cleanup(projectRoot);
  }
});

test('installer isolates failures and continues other assets', () => {
  const projectRoot = makeTempProject();
  try {
    withCodexHome(projectRoot, () => {
      const conflictingPath = path.join(projectRoot, '.claude', 'commands', 'df', 'df-new.md');
      fs.mkdirSync(conflictingPath, { recursive: true });

      const report = installSkills(projectRoot, {
        tools: 'codex,claudecode',
        delivery: 'commands',
      });

      assert.ok(report.failed >= 1);
      assert.ok(report.created > 0);

      const codexCommand = path.join(process.env.CODEX_HOME, 'prompts', 'df-new.md');
      assert.equal(fs.existsSync(codexCommand), true);
    });
  } finally {
    cleanup(projectRoot);
  }
});

test('installer refuses to overwrite unmanaged files even with force', () => {
  const projectRoot = makeTempProject();
  try {
    withCodexHome(projectRoot, () => {
      const target = path.join(projectRoot, '.codex', 'skills', 'df-new.md');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, '# user owned file\n', 'utf-8');

      const report = installSkills(projectRoot, {
        tools: 'codex',
        delivery: 'skills',
        force: true,
      });

      assert.ok(report.failed >= 1);
      const failedNewSkill = report.results.find(r => r.path.endsWith('.codex/skills/df-new.md'));
      assert.ok(failedNewSkill);
      assert.equal(failedNewSkill.errorCode, 'UNMANAGED_FILE');
      assert.equal(fs.readFileSync(target, 'utf-8'), '# user owned file\n');
    });
  } finally {
    cleanup(projectRoot);
  }
});

test('installer autodetect default installs only detected environments', () => {
  const projectRoot = makeTempProject();
  try {
    withCodexHome(projectRoot, () => {
      const report = installSkills(projectRoot, {
        detectionOverrides: {
          commandExists: (cmd) => cmd === 'codex',
          pathExists: () => false,
          homedir: path.join(projectRoot, 'home'),
          env: {},
        },
      });

      assert.deepEqual(report.selectedTools, ['codex']);
      const codexSummary = report.environments.find(e => e.tool === 'codex');
      const claudeSummary = report.environments.find(e => e.tool === 'claudecode');
      assert.equal(codexSummary.status, 'installed');
      assert.equal(claudeSummary.status, 'skipped');
      assert.equal(claudeSummary.reason, 'not-detected');
    });
  } finally {
    cleanup(projectRoot);
  }
});

test('dry-run reports planned actions without writing files', () => {
  const projectRoot = makeTempProject();
  try {
    withCodexHome(projectRoot, () => {
      const report = installSkills(projectRoot, {
        only: 'codex',
        delivery: 'skills',
        dryRun: true,
      });
      assert.equal(report.dryRun, true);
      assert.ok(report.created > 0);
      assert.ok(report.results.some(r => r.action === 'would_create'));
      const expectedPath = path.join(projectRoot, '.codex', 'skills', 'df-new.md');
      assert.equal(fs.existsSync(expectedPath), false);
    });
  } finally {
    cleanup(projectRoot);
  }
});

test('disabling autodetect targets all supported tools by default', () => {
  const projectRoot = makeTempProject();
  try {
    withCodexHome(projectRoot, () => {
      const report = installSkills(projectRoot, {
        autodetect: false,
        detectionOverrides: {
          commandExists: () => false,
          pathExists: () => false,
          homedir: path.join(projectRoot, 'home'),
          env: {},
        },
      });

      assert.deepEqual(report.selectedTools.sort(), ['claudecode', 'codex']);
      const codexSummary = report.environments.find(e => e.tool === 'codex');
      const claudeSummary = report.environments.find(e => e.tool === 'claudecode');
      assert.equal(codexSummary.status, 'installed');
      assert.equal(claudeSummary.status, 'installed');
    });
  } finally {
    cleanup(projectRoot);
  }
});

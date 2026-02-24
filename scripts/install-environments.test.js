const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  detectInstalledTools,
  getEnvironmentDetectors,
  getToolAdapter,
} = require('./install-environments');

const PROJECT_ROOT = '/workspace/project';
const HOME_DIR = '/home/tester';

function detectionHarness({ commands = [], paths = [] } = {}) {
  const commandSet = new Set(commands);
  const pathSet = new Set(paths.map(p => path.resolve(p)));
  return {
    commandExists: (command) => commandSet.has(command),
    pathExists: (targetPath) => pathSet.has(path.resolve(targetPath)),
    homedir: HOME_DIR,
    env: {},
  };
}

test('detectInstalledTools returns claudecode when only Claude signals are present', () => {
  const detected = detectInstalledTools(PROJECT_ROOT, detectionHarness({
    commands: ['claude'],
  }));
  assert.deepEqual(detected, ['claudecode']);
});

test('detectInstalledTools returns codex when only Codex signals are present', () => {
  const detected = detectInstalledTools(PROJECT_ROOT, detectionHarness({
    commands: ['codex'],
  }));
  assert.deepEqual(detected, ['codex']);
});

test('detectInstalledTools returns both tools when both signals are present', () => {
  const detected = detectInstalledTools(PROJECT_ROOT, detectionHarness({
    commands: ['codex', 'claude'],
  }));
  assert.deepEqual(detected, ['codex', 'claudecode']);
});

test('detectInstalledTools returns empty list when no signals are present', () => {
  const detected = detectInstalledTools(PROJECT_ROOT, detectionHarness());
  assert.deepEqual(detected, []);
});

test('detector registry exposes both supported tool detectors', () => {
  const detectors = getEnvironmentDetectors();
  assert.ok(detectors.codex);
  assert.ok(detectors.claudecode);
});

test('adapter contract resolves expected target directories', () => {
  const codexTargets = getToolAdapter('codex').resolveTargets(PROJECT_ROOT, {
    homedir: HOME_DIR,
    env: {},
  });
  assert.equal(codexTargets.skillsDir, path.join(PROJECT_ROOT, '.codex', 'skills'));
  assert.equal(codexTargets.commandsDir, path.join(HOME_DIR, '.codex', 'prompts'));

  const claudeTargets = getToolAdapter('claudecode').resolveTargets(PROJECT_ROOT);
  assert.equal(claudeTargets.skillsDir, path.join(PROJECT_ROOT, '.claude', 'skills'));
  assert.equal(claudeTargets.commandsDir, path.join(PROJECT_ROOT, '.claude', 'commands', 'df'));
});

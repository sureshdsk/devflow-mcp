const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const SUPPORTED_TOOLS = ['codex', 'claudecode'];
const CLAUDE_ALIASES = new Set(['claude', 'claude-code', 'claudecode']);

function normalizeToolId(value) {
  const tool = value.trim().toLowerCase();
  if (tool === 'codex') return 'codex';
  if (CLAUDE_ALIASES.has(tool)) return 'claudecode';
  throw new Error(`Unsupported tool '${tool}'. Supported: ${SUPPORTED_TOOLS.join(', ')}`);
}

function parseTools(value) {
  const raw = (value ?? 'all').trim().toLowerCase();
  if (raw === 'none') return [];
  if (raw === 'all') return [...SUPPORTED_TOOLS];
  return [
    ...new Set(
      raw
        .split(',')
        .map((p) => normalizeToolId(p.trim()))
        .filter(Boolean),
    ),
  ];
}

function defaultCommandExists(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function buildDetectionContext(projectRoot, overrides = {}) {
  return {
    projectRoot: path.resolve(projectRoot),
    env: overrides.env ?? process.env,
    homedir: overrides.homedir ?? os.homedir(),
    commandExists: overrides.commandExists ?? defaultCommandExists,
    pathExists: overrides.pathExists ?? fs.existsSync,
  };
}

function createDetectedEnvironment(id, signals) {
  const detected = signals.some((signal) => signal.present);
  return { id, detected, signals };
}

function detectCodex(context) {
  const codexHome = context.env.CODEX_HOME?.trim()
    ? path.resolve(context.env.CODEX_HOME.trim())
    : path.join(context.homedir, '.codex');
  return createDetectedEnvironment('codex', [
    { kind: 'binary', name: 'codex', present: context.commandExists('codex') },
    {
      kind: 'directory',
      name: path.join(context.projectRoot, '.codex'),
      present: context.pathExists(path.join(context.projectRoot, '.codex')),
    },
    { kind: 'directory', name: codexHome, present: context.pathExists(codexHome) },
  ]);
}

function detectClaudeCode(context) {
  return createDetectedEnvironment('claudecode', [
    { kind: 'binary', name: 'claude', present: context.commandExists('claude') },
    {
      kind: 'directory',
      name: path.join(context.projectRoot, '.claude'),
      present: context.pathExists(path.join(context.projectRoot, '.claude')),
    },
    {
      kind: 'directory',
      name: path.join(context.homedir, '.claude'),
      present: context.pathExists(path.join(context.homedir, '.claude')),
    },
  ]);
}

function getEnvironmentDetectors() {
  return {
    codex: { id: 'codex', detect: detectCodex },
    claudecode: { id: 'claudecode', detect: detectClaudeCode },
  };
}

function detectEnvironments(projectRoot, overrides = {}) {
  const context = buildDetectionContext(projectRoot, overrides);
  const detectors = getEnvironmentDetectors();
  return SUPPORTED_TOOLS.map((tool) => detectors[tool].detect(context));
}

function detectInstalledTools(projectRoot, overrides = {}) {
  return detectEnvironments(projectRoot, overrides)
    .filter((result) => result.detected)
    .map((result) => result.id);
}

function getToolAdapters() {
  return {
    codex: {
      id: 'codex',
      resolveTargets(projectRoot, options = {}) {
        const env = options.env ?? process.env;
        const homedir = options.homedir ?? os.homedir();
        const codexHome = env.CODEX_HOME?.trim()
          ? path.resolve(env.CODEX_HOME.trim())
          : path.join(homedir, '.codex');
        return {
          skillsDir: path.join(projectRoot, '.codex', 'skills'),
          commandsDir: path.join(codexHome, 'prompts'),
        };
      },
    },
    claudecode: {
      id: 'claudecode',
      resolveTargets(projectRoot) {
        return {
          skillsDir: path.join(projectRoot, '.claude', 'skills'),
          commandsDir: path.join(projectRoot, '.claude', 'commands', 'df'),
        };
      },
    },
  };
}

function getToolAdapter(tool) {
  const normalized = normalizeToolId(tool);
  const adapter = getToolAdapters()[normalized];
  if (!adapter) {
    throw new Error(`No adapter registered for tool '${normalized}'`);
  }
  return adapter;
}

module.exports = {
  CLAUDE_ALIASES,
  SUPPORTED_TOOLS,
  detectEnvironments,
  detectInstalledTools,
  getEnvironmentDetectors,
  getToolAdapter,
  getToolAdapters,
  normalizeToolId,
  parseTools,
};

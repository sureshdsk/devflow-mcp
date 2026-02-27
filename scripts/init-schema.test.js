const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  discoverSchemaTemplates,
  resolveInitSchemaSelection,
  readProjectConfig,
  writeProjectConfig,
} = require('./init-schema');

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-init-schema-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeSchema(baseDir, id) {
  const schemaDir = path.join(baseDir, id);
  fs.mkdirSync(path.join(schemaDir, 'templates'), { recursive: true });
  fs.writeFileSync(
    path.join(schemaDir, 'schema.yaml'),
    `name: ${id}\nversion: 1\nartifacts: []\n`,
    'utf-8',
  );
}

test('resolveInitSchemaSelection respects explicit schema', async () => {
  const result = await resolveInitSchemaSelection({
    requestedSchema: 'backend-api',
    existingDefaultSchema: 'spec-driven',
    availableSchemaIds: ['spec-driven', 'backend-api'],
    interactive: false,
  });
  assert.equal(result.schemaId, 'backend-api');
  assert.equal(result.reason, 'explicit');
});

test('resolveInitSchemaSelection keeps existing default in interactive mode', async () => {
  const result = await resolveInitSchemaSelection({
    existingDefaultSchema: 'frontend-product',
    availableSchemaIds: ['frontend-product', 'spec-driven'],
    interactive: true,
    confirmKeepExisting: async () => true,
    promptSelectSchema: async () => 'spec-driven',
  });
  assert.equal(result.schemaId, 'frontend-product');
  assert.equal(result.reason, 'existing-default-kept');
});

test('resolveInitSchemaSelection uses fallback in non-interactive mode', async () => {
  const result = await resolveInitSchemaSelection({
    availableSchemaIds: ['spec-driven', 'backend-api'],
    interactive: false,
  });
  assert.equal(result.schemaId, 'spec-driven');
  assert.equal(result.reason, 'non-interactive-fallback');
});

test('discoverSchemaTemplates returns bundled and project schemas', () =>
  withTempDir((root) => {
    const projectRoot = path.join(root, 'project');
    const packageRoot = path.join(root, 'package');
    const bundledDir = path.join(packageRoot, 'src', 'schemas');
    fs.mkdirSync(path.join(projectRoot, 'schemas'), { recursive: true });
    fs.mkdirSync(bundledDir, { recursive: true });

    writeSchema(bundledDir, 'spec-driven');
    writeSchema(path.join(projectRoot, 'schemas'), 'custom-team');

    const schemas = discoverSchemaTemplates({ projectRoot, packageRoot, bundledDir });
    const ids = schemas.map((s) => s.id);
    assert.deepEqual(ids, ['custom-team', 'spec-driven']);
  }));

test('discoverSchemaTemplates fails on duplicate IDs', () =>
  withTempDir((root) => {
    const projectRoot = path.join(root, 'project');
    const packageRoot = path.join(root, 'package');
    const bundledDir = path.join(packageRoot, 'src', 'schemas');
    fs.mkdirSync(path.join(projectRoot, 'schemas'), { recursive: true });
    fs.mkdirSync(bundledDir, { recursive: true });

    writeSchema(bundledDir, 'spec-driven');
    writeSchema(path.join(projectRoot, 'schemas'), 'spec-driven');

    assert.throws(
      () => discoverSchemaTemplates({ projectRoot, packageRoot, bundledDir }),
      /Schema ID conflict/,
    );
  }));

test('project config read/write round-trip', () =>
  withTempDir((projectRoot) => {
    writeProjectConfig(projectRoot, { defaultSchemaTemplateId: 'devops-platform' });
    const cfg = readProjectConfig(projectRoot);
    assert.equal(cfg.defaultSchemaTemplateId, 'devops-platform');
  }));

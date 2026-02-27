const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function getProjectConfigPath(projectRoot) {
  return path.join(projectRoot, 'devflow', 'project-config.json');
}

function readProjectConfig(projectRoot) {
  const configPath = getProjectConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

function writeProjectConfig(projectRoot, config) {
  const configPath = getProjectConfigPath(projectRoot);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function readSchemasFromDir(baseDir, source) {
  if (!fs.existsSync(baseDir)) return [];
  const entries = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const schemas = [];
  for (const entryName of entries) {
    const schemaPath = path.join(baseDir, entryName, 'schema.yaml');
    if (!fs.existsSync(schemaPath)) continue;
    const parsed = yaml.load(fs.readFileSync(schemaPath, 'utf-8')) || {};
    if (!parsed.name) {
      throw new Error(`Invalid schema at ${schemaPath}: missing name`);
    }
    schemas.push({
      id: String(parsed.name),
      source,
      schemaPath,
      templatesDir: path.join(path.dirname(schemaPath), 'templates'),
    });
  }
  return schemas;
}

function discoverSchemaTemplates(options) {
  const projectRoot = options.projectRoot;
  const packageRoot = options.packageRoot;
  const bundledDir = options.bundledDir || path.join(packageRoot, 'src', 'schemas');
  const projectSchemaDir = path.join(projectRoot, 'schemas');

  const bundled = readSchemasFromDir(bundledDir, 'bundled');
  const project = readSchemasFromDir(projectSchemaDir, 'project');
  const merged = [...bundled, ...project];

  const idToSchema = new Map();
  for (const schema of merged) {
    const existing = idToSchema.get(schema.id);
    if (existing) {
      throw new Error(
        `Schema ID conflict for "${schema.id}" between ${existing.source}:${existing.schemaPath} and ${schema.source}:${schema.schemaPath}`,
      );
    }
    idToSchema.set(schema.id, schema);
  }

  return [...idToSchema.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function assertKnownSchema(schemaId, availableSchemaIds) {
  if (!availableSchemaIds.includes(schemaId)) {
    throw new Error(
      `Unknown schema "${schemaId}". Available schemas: ${availableSchemaIds.join(', ')}`,
    );
  }
}

async function resolveInitSchemaSelection(options) {
  const {
    requestedSchema,
    existingDefaultSchema,
    availableSchemaIds,
    interactive,
    confirmKeepExisting,
    promptSelectSchema,
  } = options;

  if (requestedSchema) {
    assertKnownSchema(requestedSchema, availableSchemaIds);
    return { schemaId: requestedSchema, reason: 'explicit' };
  }

  if (!interactive) {
    if (existingDefaultSchema && availableSchemaIds.includes(existingDefaultSchema)) {
      return { schemaId: existingDefaultSchema, reason: 'existing-default' };
    }
    if (availableSchemaIds.includes('spec-driven')) {
      return { schemaId: 'spec-driven', reason: 'non-interactive-fallback' };
    }
    throw new Error(
      `Non-interactive init requires a schema. Available schemas: ${availableSchemaIds.join(', ')}`,
    );
  }

  if (existingDefaultSchema && availableSchemaIds.includes(existingDefaultSchema)) {
    const keep = (await confirmKeepExisting(existingDefaultSchema)) !== false;
    if (keep) {
      return { schemaId: existingDefaultSchema, reason: 'existing-default-kept' };
    }
  }

  const selected = await promptSelectSchema(availableSchemaIds, existingDefaultSchema);
  assertKnownSchema(selected, availableSchemaIds);
  return { schemaId: selected, reason: 'interactive-selection' };
}

module.exports = {
  discoverSchemaTemplates,
  getProjectConfigPath,
  readProjectConfig,
  resolveInitSchemaSelection,
  writeProjectConfig,
};

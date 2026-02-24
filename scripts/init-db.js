#!/usr/bin/env node

const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { migrate } = require('drizzle-orm/libsql/migrator');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const readline = require('readline');
const {
  discoverSchemaTemplates,
  readProjectConfig,
  writeProjectConfig,
  resolveInitSchemaSelection,
} = require('./init-schema');

const DB_DIR = path.join(os.homedir(), '.devflow');
const DB_PATH = path.join(DB_DIR, 'devflow.db');

function parseInitArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema') options.schema = args[++i];
    else if (args[i] === '--non-interactive') options.nonInteractive = true;
  }
  return options;
}

function askQuestion(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function chooseSchemaTemplate(projectRoot, options) {
  const packageRoot = path.join(__dirname, '..');
  const templates = discoverSchemaTemplates({ projectRoot, packageRoot });
  const availableSchemaIds = templates.map((t) => t.id);
  const config = readProjectConfig(projectRoot);
  const existingDefaultSchema = config.defaultSchemaTemplateId;
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !options.nonInteractive;

  const result = await resolveInitSchemaSelection({
    requestedSchema: options.schema,
    existingDefaultSchema,
    availableSchemaIds,
    interactive,
    confirmKeepExisting: async (current) => {
      const answer = await askQuestion(
        `Current default schema is "${current}". Keep it? [Y/n]: `
      );
      return answer === '' || /^y(es)?$/i.test(answer);
    },
    promptSelectSchema: async (ids, current) => {
      console.log('\nSelect a default schema template:');
      ids.forEach((id, idx) => {
        const marker = current === id ? ' (current)' : '';
        console.log(`  ${idx + 1}. ${id}${marker}`);
      });
      const answer = await askQuestion(`Choose [1-${ids.length}] (default 1): `);
      if (!answer) return ids[0];
      const num = Number(answer);
      if (!Number.isInteger(num) || num < 1 || num > ids.length) {
        throw new Error(`Invalid selection "${answer}"`);
      }
      return ids[num - 1];
    },
  });

  writeProjectConfig(projectRoot, {
    ...config,
    defaultSchemaTemplateId: result.schemaId,
    updatedAt: new Date().toISOString(),
  });

  return {
    schemaId: result.schemaId,
    reason: result.reason,
    configPath: path.join(projectRoot, '.devflow', 'project-config.json'),
  };
}

async function initDatabase(options = {}) {
  const projectRoot = process.cwd();
  console.log('Initializing DevFlow database...');

  // Ensure directory exists
  try {
    await fs.promises.mkdir(DB_DIR, { recursive: true });
    console.log(`✓ Created directory: ${DB_DIR}`);
  } catch (error) {
    console.log(`✓ Directory already exists: ${DB_DIR}`);
  }

  // Create database connection
  const client = createClient({
    url: `file:${DB_PATH}`,
  });

  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');

  // If DB has old schema (features table), drop and recreate
  const tables = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='features'`
  );
  if (tables.rows.length > 0) {
    console.log('⚠ Detected old schema (features table). Recreating database...');
    client.close();
    await fs.promises.unlink(DB_PATH);
    const freshClient = createClient({ url: `file:${DB_PATH}` });
    await freshClient.execute('PRAGMA journal_mode = WAL');
    await freshClient.execute('PRAGMA foreign_keys = ON');
    const freshDb = drizzle(freshClient);
    console.log('Running migrations...');
    await migrate(freshDb, { migrationsFolder: './drizzle' });
    console.log('✓ Migrations complete');
    const existingProjects = await freshClient.execute('SELECT id FROM projects LIMIT 1');
    if (existingProjects.rows.length === 0) {
      const id = randomUUID();
      const now = Math.floor(Date.now() / 1000);
      await freshClient.execute({
        sql: `INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, 'Default Project', 'Default project for tasks', 'active', now, now],
      });
      console.log('✓ Created default project');
    }
    const selected = await chooseSchemaTemplate(projectRoot, options);
    console.log(`\n✓ Default schema template: ${selected.schemaId} (${selected.reason})`);
    console.log(`✓ Saved project config: ${selected.configPath}`);
    console.log(`\n✅ Database initialized at: ${DB_PATH}`);
    console.log('\nYou can now:');
    console.log('  1. Start the web UI: devflow dev');
    console.log('  2. Start the MCP server: devflow mcp');
    freshClient.close();
    return;
  }

  const db = drizzle(client);

  // Run migrations
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('✓ Schema already up to date');
    } else {
      throw err;
    }
  }
  console.log('✓ Migrations complete');

  // Create default project if none exists
  const existingProjects = await client.execute('SELECT id FROM projects LIMIT 1');
  if (existingProjects.rows.length === 0) {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `INSERT INTO projects (id, name, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, 'Default Project', 'Default project for tasks', 'active', now, now],
    });
    console.log('✓ Created default project');
  }

  const selected = await chooseSchemaTemplate(projectRoot, options);
  console.log(`\n✓ Default schema template: ${selected.schemaId} (${selected.reason})`);
  console.log(`✓ Saved project config: ${selected.configPath}`);
  console.log(`\n✅ Database initialized at: ${DB_PATH}`);
  console.log('\nYou can now:');
  console.log('  1. Start the web UI: devflow dev');
  console.log('  2. Start the MCP server: devflow mcp');

  client.close();
}

if (require.main === module) {
  const options = parseInitArgs(process.argv.slice(2));
  initDatabase(options).catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}

module.exports = { initDatabase, parseInitArgs, chooseSchemaTemplate };

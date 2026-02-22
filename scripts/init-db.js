#!/usr/bin/env node

const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { migrate } = require('drizzle-orm/libsql/migrator');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const DB_DIR = path.join(os.homedir(), '.devflow');
const DB_PATH = path.join(DB_DIR, 'devflow.db');

async function initDatabase() {
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

  const db = drizzle(client);

  // Run migrations
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
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

  console.log(`\n✅ Database initialized at: ${DB_PATH}`);
  console.log('\nYou can now:');
  console.log('  1. Start the web UI: devflow dev');
  console.log('  2. Start the MCP server: devflow mcp');

  client.close();
}

initDatabase().catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

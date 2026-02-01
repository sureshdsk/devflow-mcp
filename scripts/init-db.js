#!/usr/bin/env node

const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
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
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  
  const db = drizzle(sqlite);

  // Run migrations
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✓ Migrations complete');

  // Create default project if none exists
  const existingProjects = sqlite.prepare('SELECT id FROM projects LIMIT 1').all();
  if (existingProjects.length === 0) {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    sqlite.prepare(`
      INSERT INTO projects (id, name, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'Default Project', 'Default project for tasks', 'active', now, now);
    console.log('✓ Created default project');
  }

  console.log(`\n✅ Database initialized at: ${DB_PATH}`);
  console.log('\nYou can now:');
  console.log('  1. Start the web UI: devflow dev');
  console.log('  2. Start the MCP server: devflow mcp');
  
  sqlite.close();
}

initDatabase().catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

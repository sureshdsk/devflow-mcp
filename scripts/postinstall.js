#!/usr/bin/env node

/**
 * Postinstall script - automatically initializes the database after npm install.
 * This runs silently and only sets up the DB if it doesn't exist.
 */

const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { migrate } = require('drizzle-orm/libsql/migrator');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const DB_DIR = path.join(os.homedir(), '.devflow');
const DB_PATH = path.join(DB_DIR, 'devflow.db');

async function postinstall() {
  try {
    // Ensure directory exists
    await fs.promises.mkdir(DB_DIR, { recursive: true });

    // Create database connection
    const client = createClient({
      url: `file:${DB_PATH}`,
    });

    await client.execute('PRAGMA journal_mode = WAL');

    const db = drizzle(client);

    // Run migrations (idempotent - safe to run multiple times)
    const migrationsFolder = path.join(__dirname, '..', 'drizzle');
    await migrate(db, { migrationsFolder });

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
    }

    client.close();
    console.log('DevFlow database ready at ~/.devflow/devflow.db');
  } catch (error) {
    // Silently fail during postinstall - user can run `devflow init` manually
    // This prevents install failures on systems where native bindings might have issues
  }
}

postinstall();

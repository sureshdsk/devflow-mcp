import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

const DB_DIR = join(homedir(), '.devflow');
const DB_PATH = join(DB_DIR, 'devflow.db');

// Ensure the directory exists
function ensureDbDir() {
  try {
    mkdirSync(DB_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

/**
 * Find the migrations folder. Works whether running from source (dev)
 * or from the built dist/server output (production).
 */
function findMigrationsFolder(): string {
  // Try common locations relative to this file
  const candidates = [
    join(__dirname, '..', '..', 'drizzle'), // from src/db/ or dist/server/
    join(__dirname, '..', 'drizzle'), // from src/ or dist/
    join(__dirname, 'drizzle'), // same dir
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'meta', '_journal.json'))) {
      return candidate;
    }
  }
  // Fallback — return first candidate and let drizzle give a clear error
  return candidates[0];
}

let dbInstance: ReturnType<typeof drizzle> | null = null;
let migrationRan = false;

export async function getDb() {
  if (dbInstance) return dbInstance;

  ensureDbDir();

  const client = createClient({
    url: `file:${DB_PATH}`,
  });

  await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');

  dbInstance = drizzle(client, { schema });

  // Auto-run migrations on first connection to ensure schema is up to date.
  // This is a safety net for cases where postinstall didn't run.
  if (!migrationRan) {
    migrationRan = true;
    try {
      const migrationsFolder = findMigrationsFolder();
      if (existsSync(join(migrationsFolder, 'meta', '_journal.json'))) {
        await migrate(dbInstance, { migrationsFolder });

        // Seed default project if needed
        const rows = await client.execute('SELECT id FROM projects LIMIT 1');
        if (rows.rows.length === 0) {
          const id = randomUUID();
          const now = Math.floor(Date.now() / 1000);
          await client.execute({
            sql: `INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [id, 'Default Project', 'Default project for tasks', 'active', now, now],
          });
        }
      }
    } catch {
      // Non-fatal: if migrations fail here, the explicit `devflow init` path
      // will give the user a proper error message.
    }
  }

  return dbInstance;
}

export { schema };

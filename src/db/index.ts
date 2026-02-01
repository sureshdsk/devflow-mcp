import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DB_DIR = join(homedir(), ".devflow");
const DB_PATH = join(DB_DIR, "devflow.db");

// Ensure the directory exists
function ensureDbDir() {
  try {
    mkdirSync(DB_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  ensureDbDir();

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  dbInstance = drizzle(sqlite, { schema });

  return dbInstance;
}

export { schema };

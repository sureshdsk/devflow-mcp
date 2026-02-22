import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
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

export async function getDb() {
  if (dbInstance) return dbInstance;

  ensureDbDir();

  const client = createClient({
    url: `file:${DB_PATH}`,
  });

  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA foreign_keys = ON");

  dbInstance = drizzle(client, { schema });

  return dbInstance;
}

export { schema };

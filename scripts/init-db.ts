import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
import * as schema from "../src/db/schema";

const DB_DIR = join(homedir(), ".devflow");
const DB_PATH = join(DB_DIR, "devflow.db");

async function initDatabase() {
  console.log("Initializing DevFlow database...");
  
  // Ensure directory exists
  try {
    await mkdir(DB_DIR, { recursive: true });
    console.log(`✓ Created directory: ${DB_DIR}`);
  } catch (error) {
    console.log(`✓ Directory already exists: ${DB_DIR}`);
  }

  // Create database connection
  const sqlite = new Database(DB_PATH, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  
  const db = drizzle(sqlite, { schema });

  // Run migrations
  console.log("Running migrations...");
  migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations complete");

  // Create default project if none exists
  const existingProjects = await db.select().from(schema.projects).limit(1);
  if (existingProjects.length === 0) {
    const defaultProject = {
      id: randomUUID(),
      name: "Default Project",
      description: "Default project for tasks",
      status: "active",
    };
    await db.insert(schema.projects).values(defaultProject);
    console.log("✓ Created default project");
  }

  console.log(`\n✅ Database initialized at: ${DB_PATH}`);
  console.log("\nYou can now:");
  console.log("  1. Start the web UI: bun dev");
  console.log("  2. Start the MCP server: bun run mcp");
  
  sqlite.close();
}

initDatabase().catch((error) => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});

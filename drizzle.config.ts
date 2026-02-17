import type { Config } from "drizzle-kit";
import { join } from "path";
import { homedir } from "os";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: `file:${join(homedir(), ".devflow", "devflow.db")}`,
  },
} satisfies Config;

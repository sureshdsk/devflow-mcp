import type { Config } from "drizzle-kit";
import { join } from "path";
import { homedir } from "os";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: join(homedir(), ".devflow", "devflow.db"),
  },
} satisfies Config;

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Projects - Top level organization
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, archived, completed
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Tasks - Individual work items
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  specName: text("spec_name"), // string ref to spec folder name, no FK
  title: text("title").notNull(),
  body: text("body"),
  status: text("status").notNull().default("backlog"), // backlog, todo, in_progress, interrupted, done
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  assignedAgent: text("assigned_agent"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const agentActivity = sqliteTable("agent_activity", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  action: text("action").notNull(), // check_in, check_out, update, comment
  details: text("details"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Specs - Planning artifacts per project
export const specs = sqliteTable("specs", {
  name: text("name").primaryKey(), // matches folder name, e.g. "add-oauth"
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  schema: text("schema").notNull().default("spec-driven"),
  status: text("status").notNull().default("active"), // active | archived
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type AgentActivity = typeof agentActivity.$inferSelect;
export type NewAgentActivity = typeof agentActivity.$inferInsert;
export type Spec = typeof specs.$inferSelect;
export type NewSpec = typeof specs.$inferInsert;

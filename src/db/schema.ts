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

// Features - Mid-level grouping within projects
export const features = sqliteTable("features", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"), // planning, in_progress, completed
  order: integer("order").notNull().default(0),
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
  featureId: text("feature_id").references(() => features.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"), // backlog, todo, in_progress, interrupted, done
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  context: text("context"), // Task-specific context for AI agents
  executionPlan: text("execution_plan"), // Agent's execution plan
  assignedAgent: text("assigned_agent"), // Which agent is working on this
  order: integer("order").notNull().default(0), // For ordering within columns
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// File attachments - Documents, images, etc. attached to projects/features/tasks
export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  featureId: text("feature_id").references(() => features.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // markdown, image, pdf, etc.
  content: text("content"), // For text-based files (markdown, etc.)
  path: text("path"), // File system path for binary files
  mimeType: text("mime_type"),
  size: integer("size"), // File size in bytes
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
  details: text("details"), // JSON string with action details
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Feature = typeof features.$inferSelect;
export type NewFeature = typeof features.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
export type AgentActivity = typeof agentActivity.$inferSelect;
export type NewAgentActivity = typeof agentActivity.$inferInsert;

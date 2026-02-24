#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDb, schema } from "../db/index.js";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { broadcastUpdate } from "./websocket.js";
import path from "path";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultProjectName(): string {
  return slugify(path.basename(process.cwd()));
}
import {
  listSpecs,
  getSpec,
  createSpec,
  getArtifact,
  writeArtifact,
  approveArtifact,
  draftArtifact,
  getSpecStatus,
  parseTasksArtifact,
  validateSpec,
  archiveSpec,
  getArtifactTemplate,
  fillTaskSummary,
  updateTaskBodyInSpec,
} from "../lib/specs.js";

const server = new Server(
  {
    name: "devflow-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Project Management
      {
        name: "list_projects",
        description: "List all projects",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["active", "archived", "completed"],
              description: "Filter by project status (optional)",
            },
          },
        },
      },
      {
        name: "create_project",
        description: "Create a new project. If name is omitted, defaults to the current directory name (slugified).",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name (optional — defaults to current directory name)" },
            description: { type: "string", description: "Project description" },
          },
        },
      },
      {
        name: "get_project",
        description: "Get project details with all tasks",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
          },
          required: ["projectId"],
        },
      },
      {
        name: "update_project",
        description: "Update project details",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            name: { type: "string", description: "New project name" },
            description: { type: "string", description: "New description" },
            status: {
              type: "string",
              enum: ["active", "archived", "completed"],
              description: "New status",
            },
          },
          required: ["projectId"],
        },
      },
      {
        name: "get_or_create_project",
        description: "Get an existing project by name or create it if it doesn't exist. If name is omitted, defaults to the current directory name (slugified). Use the project directory name as a default if no project name is specified.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name (optional — defaults to current directory name)" },
            description: { type: "string", description: "Description (used only if creating)" },
          },
        },
      },
      // Task Management
      {
        name: "list_tasks",
        description: "List tasks with optional filters",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Filter by project ID" },
            specName: { type: "string", description: "Filter by spec name" },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "interrupted", "done"],
              description: "Filter by status",
            },
            assignedAgent: { type: "string", description: "Filter by assigned agent" },
          },
        },
      },
      {
        name: "get_task",
        description: "Get details of a specific task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
          },
          required: ["taskId"],
        },
      },
      {
        name: "create_task",
        description: "Create a new task. Can auto-create project if projectName is provided instead of projectId.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            body: { type: "string", description: "Task body (markdown)" },
            description: { type: "string", description: "Task description (legacy — auto-composed into body if body not provided)" },
            context: { type: "string", description: "Additional context (legacy — auto-composed into body if body not provided)" },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Task priority",
            },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "done"],
              description: "Initial status (defaults to backlog)",
            },
            projectId: { type: "string", description: "Project ID" },
            projectName: {
              type: "string",
              description: "Project name — auto-creates the project if it doesn't exist",
            },
            specName: { type: "string", description: "Spec name to link this task to" },
          },
          required: ["title"],
        },
      },
      {
        name: "create_tasks_bulk",
        description: "Create multiple tasks at once",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID for all tasks" },
            projectName: { type: "string", description: "Project name (auto-creates if needed)" },
            specName: { type: "string", description: "Spec name to link tasks to" },
            tasks: {
              type: "array",
              description: "Array of task objects",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  body: { type: "string", description: "Task body (markdown)" },
                  description: { type: "string", description: "Legacy — auto-composed into body if body not provided" },
                  context: { type: "string", description: "Legacy — auto-composed into body if body not provided" },
                  priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                  status: { type: "string", enum: ["backlog", "todo", "in_progress", "done"] },
                },
                required: ["title"],
              },
            },
          },
          required: ["tasks"],
        },
      },
      {
        name: "update_task",
        description: "Update a task's details or status",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            title: { type: "string", description: "New title" },
            body: { type: "string", description: "New task body (markdown)" },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "interrupted", "done"],
              description: "New status",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "New priority",
            },
            specName: { type: "string", description: "Link or re-link to a spec" },
          },
          required: ["taskId"],
        },
      },
      // Agent Workflow
      {
        name: "check_in",
        description: "Agent checks in to a task (sets status to in_progress, assigns agent)",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID to check in to" },
            agentName: { type: "string", description: "Name/identifier of the agent" },
            executionPlan: { type: "string", description: "Agent's plan for completing the task" },
          },
          required: ["taskId", "agentName"],
        },
      },
      {
        name: "check_out",
        description: "Agent checks out of a task (sets status to done)",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID to check out of" },
            agentName: { type: "string", description: "Name/identifier of the agent" },
            taskSummary: {
              type: "object",
              description: "Structured summary of what was accomplished",
              properties: {
                whatWasDone: { type: "string", description: "What was accomplished" },
                filesChanged: { type: "string", description: "Files changed (optional)" },
                issuesEncountered: { type: "string", description: "Issues encountered (optional)" },
                followUps: { type: "string", description: "Follow-up items (optional)" },
              },
              required: ["whatWasDone"],
            },
          },
          required: ["taskId", "agentName"],
        },
      },
      {
        name: "log_activity",
        description: "Log an activity or comment on a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            agentName: { type: "string", description: "Name/identifier of the agent" },
            action: {
              type: "string",
              enum: ["check_in", "check_out", "update", "comment"],
              description: "Type of action",
            },
            details: { type: "string", description: "Activity details or comment" },
          },
          required: ["taskId", "agentName", "action"],
        },
      },
      {
        name: "get_activity_log",
        description: "Get activity log for a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            limit: { type: "number", description: "Max number of entries (default 50)" },
          },
          required: ["taskId"],
        },
      },
      // Spec Management
      {
        name: "list_specs",
        description: "List all specs in the devflow/specs directory",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Filter by project ID (optional)" },
          },
        },
      },
      {
        name: "create_spec",
        description: "Create a new spec folder with meta and approvals files. Run list_projects or get_or_create_project first to get a projectId.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Spec folder name (slug, e.g. add-oauth)",
            },
            title: { type: "string", description: "Human-readable title" },
            projectId: { type: "string", description: "Project ID to link to — run list_projects or get_or_create_project first" },
            description: { type: "string", description: "Optional description" },
            schema: {
              type: "string",
              description: "Schema name (defaults to spec-driven)",
            },
          },
          required: ["name", "title", "projectId"],
        },
      },
      {
        name: "get_spec",
        description: "Get full spec details including artifact contents and statuses",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
          },
          required: ["specName"],
        },
      },
      {
        name: "get_spec_status",
        description: "Get the DAG status of all artifacts in a spec",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
          },
          required: ["specName"],
        },
      },
      {
        name: "get_artifact",
        description: "Get the content of a spec artifact",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
            artifactType: {
              type: "string",
              description: "Artifact type (e.g. proposal, specs, design, tasks)",
            },
          },
          required: ["specName", "artifactType"],
        },
      },
      {
        name: "get_artifact_template",
        description: "Get the template for a spec artifact to use as a starting point",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
            artifactType: {
              type: "string",
              description: "Artifact type (e.g. proposal, specs, design, tasks)",
            },
          },
          required: ["specName", "artifactType"],
        },
      },
      {
        name: "write_artifact",
        description: "Write content to a spec artifact file. Blocked if required predecessors not approved.",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
            artifactType: {
              type: "string",
              description: "Artifact type (e.g. proposal, specs, design, tasks)",
            },
            content: { type: "string", description: "Markdown content to write" },
          },
          required: ["specName", "artifactType", "content"],
        },
      },
      {
        name: "approve_artifact",
        description: "Approve a spec artifact, allowing downstream artifacts to be written",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
            artifactType: {
              type: "string",
              description: "Artifact type to approve",
            },
            approvedBy: {
              type: "string",
              description: "Who is approving (agent name or 'human')",
            },
          },
          required: ["specName", "artifactType"],
        },
      },
      {
        name: "draft_artifact",
        description: "Reset an artifact approval back to draft state",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
            artifactType: { type: "string", description: "Artifact type to reset" },
          },
          required: ["specName", "artifactType"],
        },
      },
      {
        name: "validate_spec",
        description: "Validate a spec for completeness and quality",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
          },
          required: ["specName"],
        },
      },
      {
        name: "promote_spec",
        description: "Promote approved tasks.md to Kanban tasks. The project is read from the spec's metadata — no need to supply projectId.",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name" },
          },
          required: ["specName"],
        },
      },
      {
        name: "archive_spec",
        description: "Move a spec to the archive folder",
        inputSchema: {
          type: "object",
          properties: {
            specName: { type: "string", description: "Spec folder name to archive" },
          },
          required: ["specName"],
        },
      },
    ],
  };
});

// Tool implementations
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── Project tools ──────────────────────────────────────────────────────
      case "list_projects": {
        const db = await getDb();
        let query = db.select().from(schema.projects);
        const projects = await query.orderBy(desc(schema.projects.createdAt));

        const filtered = (args as { status?: string }).status
          ? projects.filter((p) => p.status === (args as { status: string }).status)
          : projects;

        return {
          content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
        };
      }

      case "create_project": {
        const { name: rawName, description } = args as {
          name?: string;
          description?: string;
        };
        const projectName = rawName ? slugify(rawName) : defaultProjectName();
        const db = await getDb();
        const newProject = {
          id: randomUUID(),
          name: projectName,
          description: description || null,
          status: "active" as const,
        };
        await db.insert(schema.projects).values(newProject);
        broadcastUpdate({ type: "project_created", project: newProject });
        return {
          content: [{ type: "text", text: JSON.stringify(newProject, null, 2) }],
        };
      }

      case "get_project": {
        const { projectId } = args as { projectId: string };
        const db = await getDb();
        const project = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .limit(1);

        if (project.length === 0) {
          return { content: [{ type: "text", text: "Project not found" }], isError: true };
        }

        const tasks = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.projectId, projectId))
          .orderBy(schema.tasks.order);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...project[0], tasks }, null, 2),
            },
          ],
        };
      }

      case "update_project": {
        const { projectId, ...updates } = args as {
          projectId: string;
          name?: string;
          description?: string;
          status?: string;
        };
        const db = await getDb();
        await db
          .update(schema.projects)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.projects.id, projectId));

        const updated = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .limit(1);

        broadcastUpdate({ type: "project_updated", project: updated[0] });
        return {
          content: [{ type: "text", text: JSON.stringify(updated[0], null, 2) }],
        };
      }

      case "get_or_create_project": {
        const { name: rawName, description } = args as {
          name?: string;
          description?: string;
        };
        const projectName = rawName ? slugify(rawName) : defaultProjectName();
        const db = await getDb();
        const existing = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.name, projectName))
          .limit(1);

        if (existing.length > 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ...existing[0], created: false }, null, 2) }],
          };
        }

        const newProject = {
          id: randomUUID(),
          name: projectName,
          description: description || null,
          status: "active" as const,
        };
        await db.insert(schema.projects).values(newProject);
        broadcastUpdate({ type: "project_created", project: newProject });
        return {
          content: [{ type: "text", text: JSON.stringify({ ...newProject, created: true }, null, 2) }],
        };
      }

      // ── Task tools ─────────────────────────────────────────────────────────
      case "list_tasks": {
        const { projectId, specName, status, assignedAgent } = args as {
          projectId?: string;
          specName?: string;
          status?: string;
          assignedAgent?: string;
        };
        const db = await getDb();
        let tasks = await db
          .select()
          .from(schema.tasks)
          .orderBy(schema.tasks.order);

        if (projectId) tasks = tasks.filter((t) => t.projectId === projectId);
        if (specName) tasks = tasks.filter((t) => t.specName === specName);
        if (status) tasks = tasks.filter((t) => t.status === status);
        if (assignedAgent) tasks = tasks.filter((t) => t.assignedAgent === assignedAgent);

        return {
          content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
        };
      }

      case "get_task": {
        const { taskId } = args as { taskId: string };
        const db = await getDb();
        const task = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, taskId))
          .limit(1);

        if (task.length === 0) {
          return { content: [{ type: "text", text: "Task not found" }], isError: true };
        }

        const activity = await db
          .select()
          .from(schema.agentActivity)
          .where(eq(schema.agentActivity.taskId, taskId))
          .orderBy(desc(schema.agentActivity.timestamp))
          .limit(10);

        return {
          content: [{ type: "text", text: JSON.stringify({ ...task[0], recentActivity: activity }, null, 2) }],
        };
      }

      case "create_task": {
        const { title, body: bodyParam, description, priority, status, context, projectId, projectName, specName } = args as {
          title: string;
          body?: string;
          description?: string;
          priority?: string;
          status?: string;
          context?: string;
          projectId?: string;
          projectName?: string;
          specName?: string;
        };
        const db = await getDb();

        let targetProjectId = projectId;

        if (!targetProjectId && projectName) {
          const sluggedName = slugify(projectName);
          const existing = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.name, sluggedName))
            .limit(1);

          if (existing.length > 0) {
            targetProjectId = existing[0].id;
          } else {
            const newProject = {
              id: randomUUID(),
              name: sluggedName,
              description: null,
              status: "active" as const,
            };
            await db.insert(schema.projects).values(newProject);
            targetProjectId = newProject.id;
            broadcastUpdate({ type: "project_created", project: newProject });
          }
        }

        // Backwards compat: compose body from description+context if body not provided
        let resolvedBody = bodyParam || null;
        if (!resolvedBody && description) {
          resolvedBody = `**Description**\n\n${description}`;
          if (context) {
            resolvedBody += `\n\n**Context**\n\n${context}`;
          }
        }

        const newTask = {
          id: randomUUID(),
          projectId: targetProjectId || null,
          specName: specName || null,
          title,
          body: resolvedBody,
          status: (status || "backlog") as "backlog" | "todo" | "in_progress" | "done",
          priority: (priority || "medium") as "low" | "medium" | "high" | "urgent",
          assignedAgent: null,
          order: 0,
        };

        await db.insert(schema.tasks).values(newTask);
        broadcastUpdate({ type: "task_created", task: newTask });
        return {
          content: [{ type: "text", text: JSON.stringify(newTask, null, 2) }],
        };
      }

      case "create_tasks_bulk": {
        const { projectId, projectName, specName, tasks: taskList } = args as {
          projectId?: string;
          projectName?: string;
          specName?: string;
          tasks: Array<{
            title: string;
            body?: string;
            description?: string;
            priority?: string;
            status?: string;
            context?: string;
          }>;
        };
        const db = await getDb();

        let targetProjectId = projectId;

        if (!targetProjectId && projectName) {
          const sluggedName = slugify(projectName);
          const existing = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.name, sluggedName))
            .limit(1);

          if (existing.length > 0) {
            targetProjectId = existing[0].id;
          } else {
            const newProject = {
              id: randomUUID(),
              name: sluggedName,
              description: null,
              status: "active" as const,
            };
            await db.insert(schema.projects).values(newProject);
            targetProjectId = newProject.id;
            broadcastUpdate({ type: "project_created", project: newProject });
          }
        }

        const newTasks = taskList.map((task, index) => {
          // Backwards compat: compose body from description+context if body not provided
          let resolvedBody = task.body || null;
          if (!resolvedBody && task.description) {
            resolvedBody = `**Description**\n\n${task.description}`;
            if (task.context) {
              resolvedBody += `\n\n**Context**\n\n${task.context}`;
            }
          }
          return {
            id: randomUUID(),
            projectId: targetProjectId || null,
            specName: specName || null,
            title: task.title,
            body: resolvedBody,
            status: (task.status || "backlog") as "backlog" | "todo" | "in_progress" | "done",
            priority: (task.priority || "medium") as "low" | "medium" | "high" | "urgent",
            assignedAgent: null,
            order: index,
          };
        });

        await db.insert(schema.tasks).values(newTasks);
        broadcastUpdate({ type: "tasks_created", count: newTasks.length });
        return {
          content: [{ type: "text", text: JSON.stringify({ created: newTasks.length, tasks: newTasks }, null, 2) }],
        };
      }

      case "update_task": {
        const { taskId, title, body: bodyParam, status, priority, specName } = args as {
          taskId: string;
          title?: string;
          body?: string;
          status?: string;
          priority?: string;
          specName?: string;
        };
        const updates: Record<string, unknown> = {};
        if (title !== undefined) updates.title = title;
        if (bodyParam !== undefined) updates.body = bodyParam;
        if (status !== undefined) updates.status = status;
        if (priority !== undefined) updates.priority = priority;
        if (specName !== undefined) updates.specName = specName;
        const db = await getDb();
        await db
          .update(schema.tasks)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.tasks.id, taskId));

        const updated = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, taskId))
          .limit(1);

        broadcastUpdate({ type: "task_updated", task: updated[0] });
        return {
          content: [{ type: "text", text: JSON.stringify(updated[0], null, 2) }],
        };
      }

      // ── Agent workflow tools ───────────────────────────────────────────────
      case "check_in": {
        const { taskId, agentName, executionPlan } = args as {
          taskId: string;
          agentName: string;
          executionPlan?: string;
        };
        const db = await getDb();

        // If executionPlan provided, prepend it to the existing body
        const taskSet: Record<string, unknown> = {
          status: "in_progress",
          assignedAgent: agentName,
          updatedAt: new Date(),
        };

        if (executionPlan) {
          const existingTask = await db
            .select()
            .from(schema.tasks)
            .where(eq(schema.tasks.id, taskId))
            .limit(1);
          const existingBody = existingTask[0]?.body || "";
          const planSection = `**Execution Plan**\n\n${executionPlan}`;
          taskSet.body = existingBody ? `${planSection}\n\n${existingBody}` : planSection;
        }

        await db
          .update(schema.tasks)
          .set(taskSet)
          .where(eq(schema.tasks.id, taskId));

        await db.insert(schema.agentActivity).values({
          id: randomUUID(),
          taskId,
          agentName,
          action: "check_in",
          details: executionPlan ? `Plan: ${executionPlan}` : "Checked in",
          timestamp: new Date(),
        });

        const task = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, taskId))
          .limit(1);

        broadcastUpdate({ type: "task_updated", task: task[0] });
        return {
          content: [{ type: "text", text: JSON.stringify(task[0], null, 2) }],
        };
      }

      case "check_out": {
        const { taskId, agentName, taskSummary } = args as {
          taskId: string;
          agentName: string;
          taskSummary?: {
            whatWasDone: string;
            filesChanged?: string;
            issuesEncountered?: string;
            followUps?: string;
          };
        };
        const db = await getDb();

        const taskSet: Record<string, unknown> = {
          status: "done",
          updatedAt: new Date(),
        };

        // Fill task summary placeholders if provided
        if (taskSummary) {
          const existingTask = await db
            .select()
            .from(schema.tasks)
            .where(eq(schema.tasks.id, taskId))
            .limit(1);
          const existingBody = existingTask[0]?.body || "";
          const updatedBody = fillTaskSummary(existingBody, taskSummary);
          taskSet.body = updatedBody;

          // Write back to tasks.md on disk if spec linked
          const specName = existingTask[0]?.specName;
          const taskTitle = existingTask[0]?.title;
          if (specName && taskTitle) {
            await updateTaskBodyInSpec(specName, taskTitle, updatedBody);
          }
        }

        await db
          .update(schema.tasks)
          .set(taskSet)
          .where(eq(schema.tasks.id, taskId));

        await db.insert(schema.agentActivity).values({
          id: randomUUID(),
          taskId,
          agentName,
          action: "check_out",
          details: taskSummary ? taskSummary.whatWasDone : "Checked out",
          timestamp: new Date(),
        });

        const task = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, taskId))
          .limit(1);

        broadcastUpdate({ type: "task_updated", task: task[0] });
        return {
          content: [{ type: "text", text: JSON.stringify(task[0], null, 2) }],
        };
      }

      case "log_activity": {
        const { taskId, agentName, action, details } = args as {
          taskId: string;
          agentName: string;
          action: string;
          details?: string;
        };
        const db = await getDb();

        const entry = {
          id: randomUUID(),
          taskId,
          agentName,
          action,
          details: details || null,
          timestamp: new Date(),
        };

        await db.insert(schema.agentActivity).values(entry);
        broadcastUpdate({ type: "activity_logged", taskId });
        return {
          content: [{ type: "text", text: JSON.stringify(entry, null, 2) }],
        };
      }

      case "get_activity_log": {
        const { taskId, limit } = args as { taskId: string; limit?: number };
        const db = await getDb();

        const activity = await db
          .select()
          .from(schema.agentActivity)
          .where(eq(schema.agentActivity.taskId, taskId))
          .orderBy(desc(schema.agentActivity.timestamp))
          .limit(limit || 50);

        return {
          content: [{ type: "text", text: JSON.stringify(activity, null, 2) }],
        };
      }

      // ── Spec tools ─────────────────────────────────────────────────────────
      case "list_specs": {
        const { projectId: filterProjectId } = args as { projectId?: string };
        let specs;
        if (filterProjectId) {
          const db = await getDb();
          const dbSpecs = await db
            .select()
            .from(schema.specs)
            .where(eq(schema.specs.projectId, filterProjectId));
          specs = dbSpecs;
        } else {
          specs = await listSpecs();
        }
        return {
          content: [{ type: "text", text: JSON.stringify(specs, null, 2) }],
        };
      }

      case "create_spec": {
        const { name: specName, title, projectId, description, schema: schemaName } = args as {
          name: string;
          title: string;
          projectId: string;
          description?: string;
          schema?: string;
        };
        await createSpec(specName, title, projectId, description, schemaName);
        broadcastUpdate({ type: "spec_created", specName });
        return {
          content: [{ type: "text", text: JSON.stringify({ name: specName, title, projectId, created: true }, null, 2) }],
        };
      }

      case "get_spec": {
        const { specName } = args as { specName: string };
        const spec = await getSpec(specName);
        return {
          content: [{ type: "text", text: JSON.stringify(spec, null, 2) }],
        };
      }

      case "get_spec_status": {
        const { specName } = args as { specName: string };
        const statuses = await getSpecStatus(specName);
        return {
          content: [{ type: "text", text: JSON.stringify(statuses, null, 2) }],
        };
      }

      case "get_artifact": {
        const { specName, artifactType } = args as { specName: string; artifactType: string };
        const content = await getArtifact(specName, artifactType);
        if (content === null) {
          return { content: [{ type: "text", text: `Artifact "${artifactType}" not found in spec "${specName}"` }], isError: true };
        }
        return {
          content: [{ type: "text", text: content }],
        };
      }

      case "get_artifact_template": {
        const { specName, artifactType } = args as { specName: string; artifactType: string };
        const template = await getArtifactTemplate(specName, artifactType);
        return {
          content: [{ type: "text", text: template }],
        };
      }

      case "write_artifact": {
        const { specName, artifactType, content } = args as {
          specName: string;
          artifactType: string;
          content: string;
        };

        // Check blocker gate
        const statuses = await getSpecStatus(specName);
        const status = statuses.find((s) => s.id === artifactType);
        if (status?.state === "blocked") {
          return {
            content: [{ type: "text", text: `Cannot write "${artifactType}": required artifacts (${status.requires.join(", ")}) must be approved first` }],
            isError: true,
          };
        }

        await writeArtifact(specName, artifactType, content);
        broadcastUpdate({ type: "artifact_updated", specName, artifactType });
        return {
          content: [{ type: "text", text: `Successfully wrote ${artifactType} for spec "${specName}"` }],
        };
      }

      case "approve_artifact": {
        const { specName, artifactType, approvedBy } = args as {
          specName: string;
          artifactType: string;
          approvedBy?: string;
        };
        await approveArtifact(specName, artifactType, approvedBy || "agent");
        broadcastUpdate({ type: "artifact_approved", specName, artifactType });
        return {
          content: [{ type: "text", text: `Approved "${artifactType}" for spec "${specName}"` }],
        };
      }

      case "draft_artifact": {
        const { specName, artifactType } = args as { specName: string; artifactType: string };
        await draftArtifact(specName, artifactType);
        broadcastUpdate({ type: "artifact_drafted", specName, artifactType });
        return {
          content: [{ type: "text", text: `Reset "${artifactType}" to draft for spec "${specName}"` }],
        };
      }

      case "validate_spec": {
        const { specName } = args as { specName: string };
        const report = await validateSpec(specName);
        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        };
      }

      case "promote_spec": {
        const { specName } = args as { specName: string };

        const specDetail = await getSpec(specName);
        const projectId = specDetail.projectId;
        if (!projectId) {
          return {
            content: [{ type: "text", text: 'Spec has no project — re-create it with a projectId' }],
            isError: true,
          };
        }

        if (specDetail.approvals.artifacts["tasks"]?.state !== "approved") {
          return {
            content: [{ type: "text", text: 'tasks artifact must be approved before promoting' }],
            isError: true,
          };
        }

        const parsedTasks = await parseTasksArtifact(specName);
        if (parsedTasks.length === 0) {
          return {
            content: [{ type: "text", text: "No tasks found in tasks.md" }],
            isError: true,
          };
        }

        const db = await getDb();
        const newTasks = parsedTasks.map((task, index) => ({
          id: randomUUID(),
          projectId,
          specName,
          title: task.title,
          body: task.body || null,
          status: "backlog" as const,
          priority: (task.priority || "medium") as "low" | "medium" | "high" | "urgent",
          assignedAgent: null,
          order: index,
        }));

        await db.insert(schema.tasks).values(newTasks);
        broadcastUpdate({ type: "spec_promoted", specName, taskCount: newTasks.length });
        return {
          content: [{ type: "text", text: JSON.stringify({ promoted: newTasks.length, tasks: newTasks }, null, 2) }],
        };
      }

      case "archive_spec": {
        const { specName } = args as { specName: string };
        await archiveSpec(specName);
        broadcastUpdate({ type: "spec_archived", specName });
        return {
          content: [{ type: "text", text: `Archived spec "${specName}"` }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

function resolveAgentName(): string {
  // 1. Env-based detection (set by agent host process)
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) return "Claude Code";
  if (process.env.CODEX) return "Codex";
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_CHANNEL) return "Cursor";
  if (process.env.WINDSURF_PLUGIN_VERSION) return "Windsurf";
  // 2. MCP clientInfo (available after initialize handshake)
  const clientInfo = server.getClientVersion();
  if (clientInfo?.name) {
    const n = clientInfo.name.toLowerCase();
    if (n.includes("claude")) return "Claude Code";
    if (n.includes("codex")) return "Codex";
    if (n.includes("cursor")) return "Cursor";
    if (n.includes("windsurf")) return "Windsurf";
    if (n.includes("copilot")) return "Copilot";
    return clientInfo.name; // use as-is if unrecognized
  }
  return "Unknown Agent";
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DevFlow MCP server running on stdio");

  // Re-broadcast identify after initialize so clientInfo is available
  // The initial identify (sent on WS open) uses env-based detection;
  // this one fires ~1s later with the MCP clientInfo name as fallback.
  setTimeout(() => {
    broadcastUpdate({ type: "identify", role: "mcp", agent: resolveAgentName() });
  }, 1000);
}

main().catch(console.error);

#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getDb, schema } from "../db/index-bun.js";
import { eq, desc, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { broadcastUpdate } from "./websocket.js";

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
        description: "Create a new project",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description" },
          },
          required: ["name"],
        },
      },
      {
        name: "get_project",
        description: "Get project details with all features and tasks",
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
        description: "Get a project by name, creating it if it doesn't exist. Use this to ensure a project exists before adding tasks.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name to find or create" },
            description: { type: "string", description: "Project description (used only if creating)" },
          },
          required: ["name"],
        },
      },

      // Feature Management
      {
        name: "list_features",
        description: "List features in a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
          },
          required: ["projectId"],
        },
      },
      {
        name: "create_feature",
        description: "Create a new feature in a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            name: { type: "string", description: "Feature name" },
            description: { type: "string", description: "Feature description" },
          },
          required: ["projectId", "name"],
        },
      },
      {
        name: "get_feature",
        description: "Get feature details with all tasks",
        inputSchema: {
          type: "object",
          properties: {
            featureId: { type: "string", description: "Feature ID" },
          },
          required: ["featureId"],
        },
      },
      {
        name: "update_feature",
        description: "Update an existing feature",
        inputSchema: {
          type: "object",
          properties: {
            featureId: { type: "string", description: "Feature ID" },
            name: { type: "string", description: "New feature name" },
            description: { type: "string", description: "New description" },
            status: {
              type: "string",
              enum: ["planning", "in_progress", "completed"],
              description: "New status",
            },
            order: { type: "number", description: "New order position" },
          },
          required: ["featureId"],
        },
      },
      {
        name: "create_features_bulk",
        description: "Create multiple features at once in a project",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID" },
            features: {
              type: "array",
              description: "Array of feature objects",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Feature name" },
                  description: { type: "string", description: "Feature description" },
                },
                required: ["name"],
              },
            },
          },
          required: ["projectId", "features"],
        },
      },

      // File Management
      {
        name: "upload_file",
        description: "Upload a file (markdown, image, etc.) to a project, feature, or task",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "File name" },
            type: {
              type: "string",
              enum: ["markdown", "image", "pdf", "other"],
              description: "File type",
            },
            content: { type: "string", description: "File content (for text files)" },
            projectId: { type: "string", description: "Project ID (optional)" },
            featureId: { type: "string", description: "Feature ID (optional)" },
            taskId: { type: "string", description: "Task ID (optional)" },
          },
          required: ["name", "type", "content"],
        },
      },
      {
        name: "list_files",
        description: "List files attached to a project, feature, or task",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID (optional)" },
            featureId: { type: "string", description: "Feature ID (optional)" },
            taskId: { type: "string", description: "Task ID (optional)" },
          },
        },
      },
      {
        name: "get_file",
        description: "Get file content",
        inputSchema: {
          type: "object",
          properties: {
            fileId: { type: "string", description: "File ID" },
          },
          required: ["fileId"],
        },
      },
      {
        name: "update_file",
        description: "Update file content",
        inputSchema: {
          type: "object",
          properties: {
            fileId: { type: "string", description: "File ID" },
            content: { type: "string", description: "New file content" },
          },
          required: ["fileId", "content"],
        },
      },

      // Task Management
      {
        name: "list_tasks",
        description: "List tasks, optionally filtered by project, feature, or status",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Filter by project ID" },
            featureId: { type: "string", description: "Filter by feature ID" },
            status: {
              type: "string",
              enum: ["backlog", "todo", "in_progress", "interrupted", "done"],
              description: "Filter by status",
            },
          },
        },
      },
      {
        name: "get_task",
        description: "Get detailed task information with all context and files",
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
        description: "Create a new task. You can specify either projectId or projectName (which will auto-create the project if it doesn't exist).",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID (optional if projectName is provided)" },
            projectName: { type: "string", description: "Project name - will find or create the project automatically" },
            featureId: { type: "string", description: "Feature ID (optional)" },
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description" },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Task priority",
            },
            context: { type: "string", description: "Task context for AI agents" },
          },
          required: ["title"],
        },
      },
      {
        name: "create_tasks_bulk",
        description: "Create multiple tasks at once. You can specify either projectId or projectName.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project ID (optional if projectName is provided)" },
            projectName: { type: "string", description: "Project name - will find or create the project automatically" },
            featureId: { type: "string", description: "Feature ID (optional)" },
            tasks: {
              type: "array",
              description: "Array of task objects",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string" },
                  context: { type: "string" },
                },
                required: ["title"],
              },
            },
          },
          required: ["projectId", "tasks"],
        },
      },
      {
        name: "update_task",
        description: "Update an existing task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            title: { type: "string", description: "New title" },
            description: { type: "string", description: "New description" },
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
            context: { type: "string", description: "Updated context" },
            executionPlan: { type: "string", description: "Agent's execution plan" },
          },
          required: ["taskId"],
        },
      },
      {
        name: "check_in",
        description: "Agent checks in to work on a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            agentName: { type: "string", description: "Agent name" },
            executionPlan: { type: "string", description: "Execution plan" },
          },
          required: ["taskId", "agentName"],
        },
      },
      {
        name: "check_out",
        description: "Agent checks out from a task",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            agentName: { type: "string", description: "Agent name" },
            summary: { type: "string", description: "Work summary" },
          },
          required: ["taskId", "agentName"],
        },
      },
      {
        name: "log_activity",
        description: "Log agent activity",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            agentName: { type: "string", description: "Agent name" },
            action: { type: "string", description: "Action performed" },
            details: { type: "string", description: "Additional details" },
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
          },
          required: ["taskId"],
        },
      },
    ],
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const db = getDb();

  try {
    switch (request.params.name) {
      // Project Management
      case "list_projects": {
        const { status } = request.params.arguments as { status?: string };
        let projects;
        if (status) {
          projects = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.status, status));
        } else {
          projects = await db.select().from(schema.projects);
        }
        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "create_project": {
        const { name, description } = request.params.arguments as {
          name: string;
          description?: string;
        };
        const newProject = {
          id: randomUUID(),
          name,
          description: description || null,
          status: "active",
        };
        await db.insert(schema.projects).values(newProject);
        broadcastUpdate({ type: "project_created", project: newProject });
        return {
          content: [
            { type: "text", text: `Project created: ${newProject.id}` },
          ],
        };
      }

      case "get_project": {
        const { projectId } = request.params.arguments as { projectId: string };
        const project = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .limit(1);
        if (project.length === 0) {
          throw new Error(`Project ${projectId} not found`);
        }
        const features = await db
          .select()
          .from(schema.features)
          .where(eq(schema.features.projectId, projectId));
        const tasks = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.projectId, projectId));
        const files = await db
          .select()
          .from(schema.files)
          .where(eq(schema.files.projectId, projectId));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { project: project[0], features, tasks, files },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_project": {
        const { projectId, ...updates } = request.params.arguments as any;
        const updateData: any = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.description !== undefined)
          updateData.description = updates.description;
        if (updates.status) updateData.status = updates.status;
        updateData.updatedAt = new Date();
        await db
          .update(schema.projects)
          .set(updateData)
          .where(eq(schema.projects.id, projectId));
        broadcastUpdate({ type: "project_updated", projectId, updates });
        return {
          content: [{ type: "text", text: `Project ${projectId} updated` }],
        };
      }

      case "get_or_create_project": {
        const { name, description } = request.params.arguments as {
          name: string;
          description?: string;
        };

        // Try to find existing project by name (case-insensitive)
        const existingProjects = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.name, name));

        if (existingProjects.length > 0) {
          const project = existingProjects[0];
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  action: "found",
                  project
                }, null, 2),
              },
            ],
          };
        }

        // Create new project
        const newProject = {
          id: randomUUID(),
          name,
          description: description || null,
          status: "active",
        };
        await db.insert(schema.projects).values(newProject);
        broadcastUpdate({ type: "project_created", project: newProject });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                action: "created",
                project: newProject
              }, null, 2),
            },
          ],
        };
      }

      // Feature Management
      case "list_features": {
        const { projectId } = request.params.arguments as { projectId: string };
        const features = await db
          .select()
          .from(schema.features)
          .where(eq(schema.features.projectId, projectId))
          .orderBy(schema.features.order);
        return {
          content: [{ type: "text", text: JSON.stringify(features, null, 2) }],
        };
      }

      case "create_feature": {
        const { projectId, name, description } = request.params.arguments as {
          projectId: string;
          name: string;
          description?: string;
        };
        const newFeature = {
          id: randomUUID(),
          projectId,
          name,
          description: description || null,
          status: "planning",
          order: 0,
        };
        await db.insert(schema.features).values(newFeature);
        broadcastUpdate({ type: "feature_created", feature: newFeature });
        return {
          content: [
            { type: "text", text: `Feature created: ${newFeature.id}` },
          ],
        };
      }

      case "get_feature": {
        const { featureId } = request.params.arguments as { featureId: string };
        const feature = await db
          .select()
          .from(schema.features)
          .where(eq(schema.features.id, featureId))
          .limit(1);
        if (feature.length === 0) {
          throw new Error(`Feature ${featureId} not found`);
        }
        const tasks = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.featureId, featureId));
        const files = await db
          .select()
          .from(schema.files)
          .where(eq(schema.files.featureId, featureId));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { feature: feature[0], tasks, files },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_feature": {
        const { featureId, ...updates } = request.params.arguments as {
          featureId: string;
          name?: string;
          description?: string;
          status?: string;
          order?: number;
        };
        const updateData: Record<string, unknown> = {};
        if (updates.name) updateData.name = updates.name;
        if (updates.description !== undefined)
          updateData.description = updates.description;
        if (updates.status) updateData.status = updates.status;
        if (updates.order !== undefined) updateData.order = updates.order;
        updateData.updatedAt = new Date();
        await db
          .update(schema.features)
          .set(updateData)
          .where(eq(schema.features.id, featureId));
        broadcastUpdate({ type: "feature_updated", featureId, updates });
        return {
          content: [{ type: "text", text: `Feature ${featureId} updated` }],
        };
      }

      case "create_features_bulk": {
        const { projectId, features } = request.params.arguments as {
          projectId: string;
          features: Array<{
            name: string;
            description?: string;
          }>;
        };

        // Verify project exists
        const project = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .limit(1);
        if (project.length === 0) {
          throw new Error(`Project ${projectId} not found`);
        }

        const newFeatures = features.map((feature, index) => ({
          id: randomUUID(),
          projectId,
          name: feature.name,
          description: feature.description || null,
          status: "planning",
          order: index,
        }));
        await db.insert(schema.features).values(newFeatures);
        broadcastUpdate({ type: "features_created_bulk", features: newFeatures });
        return {
          content: [
            {
              type: "text",
              text: `Created ${newFeatures.length} features in project ${projectId}:\n${newFeatures.map(f => `- ${f.name} (${f.id})`).join('\n')}`,
            },
          ],
        };
      }

      // File Management
      case "upload_file": {
        const { name, type, content, projectId, featureId, taskId } =
          request.params.arguments as {
            name: string;
            type: string;
            content: string;
            projectId?: string;
            featureId?: string;
            taskId?: string;
          };
        const newFile = {
          id: randomUUID(),
          projectId: projectId || null,
          featureId: featureId || null,
          taskId: taskId || null,
          name,
          type,
          content,
          path: null,
          mimeType: type === "markdown" ? "text/markdown" : null,
          size: content.length,
        };
        await db.insert(schema.files).values(newFile);
        broadcastUpdate({ type: "file_uploaded", file: newFile });
        return {
          content: [{ type: "text", text: `File uploaded: ${newFile.id}` }],
        };
      }

      case "list_files": {
        const { projectId, featureId, taskId } = request.params.arguments as {
          projectId?: string;
          featureId?: string;
          taskId?: string;
        };
        let files;
        if (taskId) {
          files = await db
            .select()
            .from(schema.files)
            .where(eq(schema.files.taskId, taskId));
        } else if (featureId) {
          files = await db
            .select()
            .from(schema.files)
            .where(eq(schema.files.featureId, featureId));
        } else if (projectId) {
          files = await db
            .select()
            .from(schema.files)
            .where(eq(schema.files.projectId, projectId));
        } else {
          files = await db.select().from(schema.files);
        }
        return {
          content: [{ type: "text", text: JSON.stringify(files, null, 2) }],
        };
      }

      case "get_file": {
        const { fileId } = request.params.arguments as { fileId: string };
        const file = await db
          .select()
          .from(schema.files)
          .where(eq(schema.files.id, fileId))
          .limit(1);
        if (file.length === 0) {
          throw new Error(`File ${fileId} not found`);
        }
        return {
          content: [{ type: "text", text: JSON.stringify(file[0], null, 2) }],
        };
      }

      case "update_file": {
        const { fileId, content } = request.params.arguments as {
          fileId: string;
          content: string;
        };
        await db
          .update(schema.files)
          .set({ content, size: content.length, updatedAt: new Date() })
          .where(eq(schema.files.id, fileId));
        broadcastUpdate({ type: "file_updated", fileId });
        return {
          content: [{ type: "text", text: `File ${fileId} updated` }],
        };
      }

      // Task Management
      case "list_tasks": {
        const { projectId, featureId, status } = request.params.arguments as {
          projectId?: string;
          featureId?: string;
          status?: string;
        };
        let query = db.select().from(schema.tasks);
        const conditions = [];
        if (projectId) conditions.push(eq(schema.tasks.projectId, projectId));
        if (featureId) conditions.push(eq(schema.tasks.featureId, featureId));
        if (status) conditions.push(eq(schema.tasks.status, status));
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }
        const tasks = await query.orderBy(schema.tasks.order);
        return {
          content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
        };
      }

      case "get_task": {
        const { taskId } = request.params.arguments as { taskId: string };
        const task = await db
          .select()
          .from(schema.tasks)
          .where(eq(schema.tasks.id, taskId))
          .limit(1);
        if (task.length === 0) {
          throw new Error(`Task ${taskId} not found`);
        }
        const files = await db
          .select()
          .from(schema.files)
          .where(eq(schema.files.taskId, taskId));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ task: task[0], files }, null, 2),
            },
          ],
        };
      }

      case "create_task": {
        const { projectId, projectName, featureId, title, description, priority, context } =
          request.params.arguments as {
            projectId?: string;
            projectName?: string;
            featureId?: string;
            title: string;
            description?: string;
            priority?: string;
            context?: string;
          };

        // Resolve project ID from projectName if needed
        let resolvedProjectId = projectId;
        if (!resolvedProjectId && projectName) {
          // Try to find existing project by name
          const existingProjects = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.name, projectName));

          if (existingProjects.length > 0) {
            resolvedProjectId = existingProjects[0].id;
          } else {
            // Create new project
            const newProject = {
              id: randomUUID(),
              name: projectName,
              description: null,
              status: "active",
            };
            await db.insert(schema.projects).values(newProject);
            broadcastUpdate({ type: "project_created", project: newProject });
            resolvedProjectId = newProject.id;
          }
        }

        if (!resolvedProjectId) {
          // Fall back to first active project
          const defaultProject = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.status, "active"))
            .limit(1);

          if (defaultProject.length === 0) {
            throw new Error("No project specified and no active project found. Please provide projectId or projectName.");
          }
          resolvedProjectId = defaultProject[0].id;
        }

        const newTask = {
          id: randomUUID(),
          projectId: resolvedProjectId,
          featureId: featureId || null,
          title,
          description: description || null,
          status: "backlog",
          priority: priority || "medium",
          context: context || null,
          executionPlan: null,
          assignedAgent: null,
          order: 0,
        };
        await db.insert(schema.tasks).values(newTask);
        broadcastUpdate({ type: "task_created", task: newTask });
        return {
          content: [{ type: "text", text: `Task created: ${newTask.id} in project ${resolvedProjectId}` }],
        };
      }

      case "create_tasks_bulk": {
        const { projectId, projectName, featureId, tasks } = request.params.arguments as {
          projectId?: string;
          projectName?: string;
          featureId?: string;
          tasks: Array<{
            title: string;
            description?: string;
            priority?: string;
            context?: string;
          }>;
        };

        // Resolve project ID from projectName if needed
        let resolvedProjectId = projectId;
        if (!resolvedProjectId && projectName) {
          const existingProjects = await db
            .select()
            .from(schema.projects)
            .where(eq(schema.projects.name, projectName));

          if (existingProjects.length > 0) {
            resolvedProjectId = existingProjects[0].id;
          } else {
            const newProject = {
              id: randomUUID(),
              name: projectName,
              description: null,
              status: "active",
            };
            await db.insert(schema.projects).values(newProject);
            broadcastUpdate({ type: "project_created", project: newProject });
            resolvedProjectId = newProject.id;
          }
        }

        if (!resolvedProjectId) {
          throw new Error("No project specified. Please provide projectId or projectName.");
        }

        const newTasks = tasks.map((task, index) => ({
          id: randomUUID(),
          projectId: resolvedProjectId,
          featureId: featureId || null,
          title: task.title,
          description: task.description || null,
          status: "backlog",
          priority: task.priority || "medium",
          context: task.context || null,
          executionPlan: null,
          assignedAgent: null,
          order: index,
        }));
        await db.insert(schema.tasks).values(newTasks);
        broadcastUpdate({ type: "tasks_created_bulk", tasks: newTasks });
        return {
          content: [
            { type: "text", text: `Created ${newTasks.length} tasks in project ${resolvedProjectId}` },
          ],
        };
      }

      case "update_task": {
        const { taskId, ...updates } = request.params.arguments as any;
        const updateData: any = {};
        if (updates.title) updateData.title = updates.title;
        if (updates.description !== undefined)
          updateData.description = updates.description;
        if (updates.status) updateData.status = updates.status;
        if (updates.priority) updateData.priority = updates.priority;
        if (updates.context !== undefined) updateData.context = updates.context;
        if (updates.executionPlan !== undefined)
          updateData.executionPlan = updates.executionPlan;
        updateData.updatedAt = new Date();
        await db
          .update(schema.tasks)
          .set(updateData)
          .where(eq(schema.tasks.id, taskId));
        broadcastUpdate({ type: "task_updated", taskId, updates });
        return {
          content: [{ type: "text", text: `Task ${taskId} updated` }],
        };
      }

      case "check_in": {
        const { taskId, agentName, executionPlan } = request.params
          .arguments as {
          taskId: string;
          agentName: string;
          executionPlan?: string;
        };
        await db
          .update(schema.tasks)
          .set({
            status: "in_progress",
            assignedAgent: agentName,
            executionPlan: executionPlan || null,
            updatedAt: new Date(),
          })
          .where(eq(schema.tasks.id, taskId));
        const activityId = randomUUID();
        await db.insert(schema.agentActivity).values({
          id: activityId,
          taskId,
          agentName,
          action: "check_in",
          details: executionPlan ? JSON.stringify({ executionPlan }) : null,
        });
        broadcastUpdate({ type: "agent_checked_in", taskId, agentName });
        return {
          content: [
            { type: "text", text: `Agent ${agentName} checked in to ${taskId}` },
          ],
        };
      }

      case "check_out": {
        const { taskId, agentName, summary } = request.params.arguments as {
          taskId: string;
          agentName: string;
          summary?: string;
        };
        await db
          .update(schema.tasks)
          .set({ status: "done", updatedAt: new Date() })
          .where(eq(schema.tasks.id, taskId));
        const activityId = randomUUID();
        await db.insert(schema.agentActivity).values({
          id: activityId,
          taskId,
          agentName,
          action: "check_out",
          details: summary ? JSON.stringify({ summary }) : null,
        });
        broadcastUpdate({ type: "agent_checked_out", taskId, agentName });
        return {
          content: [
            {
              type: "text",
              text: `Agent ${agentName} checked out from ${taskId}`,
            },
          ],
        };
      }

      case "log_activity": {
        const { taskId, agentName, action, details } = request.params
          .arguments as {
          taskId: string;
          agentName: string;
          action: string;
          details?: string;
        };
        const activityId = randomUUID();
        await db.insert(schema.agentActivity).values({
          id: activityId,
          taskId,
          agentName,
          action,
          details: details || null,
        });
        return {
          content: [{ type: "text", text: `Activity logged for ${taskId}` }],
        };
      }

      case "get_activity_log": {
        const { taskId } = request.params.arguments as { taskId: string };
        const activities = await db
          .select()
          .from(schema.agentActivity)
          .where(eq(schema.agentActivity.taskId, taskId))
          .orderBy(desc(schema.agentActivity.timestamp));
        return {
          content: [{ type: "text", text: JSON.stringify(activities, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DevFlow MCP Server v2.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

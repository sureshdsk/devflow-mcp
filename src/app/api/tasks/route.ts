import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const db = await getDb();
    const tasks = await db.select().from(schema.tasks).orderBy(schema.tasks.order);
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, priority, context, status, projectId, featureId } = body;

    const db = await getDb();

    // Get project ID (use provided or get default)
    let targetProjectId = projectId;
    if (!targetProjectId) {
      const defaultProject = await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.status, "active"))
        .limit(1);
      if (defaultProject.length === 0) {
        return NextResponse.json(
          { error: "No active project found. Please create a project first." },
          { status: 400 }
        );
      }
      targetProjectId = defaultProject[0].id;
    }

    const newTask = {
      id: randomUUID(),
      projectId: targetProjectId,
      featureId: featureId || null,
      title,
      description: description || null,
      status: status || "backlog",
      priority: priority || "medium",
      context: context || null,
      executionPlan: null,
      assignedAgent: null,
      order: 0,
    };

    await db.insert(schema.tasks).values(newTask);

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();

    // Check if project exists
    const project = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all tasks for this project to delete their activity logs
    const projectTasks = await db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, id));

    // Delete in order to respect foreign keys:
    // 1. Delete agent activity for all tasks in this project
    for (const task of projectTasks) {
      await db.delete(schema.agentActivity).where(eq(schema.agentActivity.taskId, task.id));
    }

    // 2. Delete files attached to tasks, features, or project
    await db.delete(schema.files).where(eq(schema.files.projectId, id));

    // 3. Delete tasks
    await db.delete(schema.tasks).where(eq(schema.tasks.projectId, id));

    // 4. Delete features
    await db.delete(schema.features).where(eq(schema.features.projectId, id));

    // 5. Finally delete the project
    await db.delete(schema.projects).where(eq(schema.projects.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: "Failed to delete project", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    updateData.updatedAt = new Date();

    const db = await getDb();
    await db.update(schema.projects).set(updateData).where(eq(schema.projects.id, id));

    const updatedProject = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    return NextResponse.json(updatedProject[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    const task = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    if (task.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch task" },
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
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.specName !== undefined) updateData.specName = body.specName;
    if (body.assignedAgent !== undefined) updateData.assignedAgent = body.assignedAgent;
    if (body.order !== undefined) updateData.order = body.order;

    updateData.updatedAt = new Date();

    const db = await getDb();
    await db.update(schema.tasks).set(updateData).where(eq(schema.tasks.id, id));

    const updatedTask = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    return NextResponse.json(updatedTask[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getDb();
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

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

    const feature = await db
      .select()
      .from(schema.features)
      .where(eq(schema.features.id, id))
      .limit(1);

    if (feature.length === 0) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 }
      );
    }

    // Get files attached to this feature
    const files = await db
      .select()
      .from(schema.files)
      .where(eq(schema.files.featureId, id));

    // Get tasks in this feature
    const tasks = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.featureId, id));

    return NextResponse.json({
      ...feature[0],
      files,
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch feature" },
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
    const { name, description, status, order } = body;

    const db = await getDb();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (order !== undefined) updateData.order = order;

    await db
      .update(schema.features)
      .set(updateData)
      .where(eq(schema.features.id, id));

    const updated = await db
      .select()
      .from(schema.features)
      .where(eq(schema.features.id, id))
      .limit(1);

    return NextResponse.json(updated[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update feature" },
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

    await db.delete(schema.features).where(eq(schema.features.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete feature" },
      { status: 500 }
    );
  }
}

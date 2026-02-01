import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const file = await db
      .select()
      .from(schema.files)
      .where(eq(schema.files.id, id))
      .limit(1);

    if (file.length === 0) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(file[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch file" },
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
    const { name, content } = body;

    const db = getDb();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (content !== undefined) {
      updateData.content = content;
      updateData.size = content.length;
    }

    await db
      .update(schema.files)
      .set(updateData)
      .where(eq(schema.files.id, id));

    const updated = await db
      .select()
      .from(schema.files)
      .where(eq(schema.files.id, id))
      .limit(1);

    return NextResponse.json(updated[0]);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update file" },
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
    const db = getDb();

    await db.delete(schema.files).where(eq(schema.files.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

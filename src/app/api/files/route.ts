import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const featureId = searchParams.get("featureId");
    const taskId = searchParams.get("taskId");

    const db = await getDb();

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

    return NextResponse.json(files);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, content, projectId, featureId, taskId } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "File name and type are required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const newFile = {
      id: randomUUID(),
      projectId: projectId || null,
      featureId: featureId || null,
      taskId: taskId || null,
      name,
      type,
      content: content || null,
      path: null,
      mimeType: type === "markdown" ? "text/markdown" : null,
      size: content ? content.length : 0,
    };

    await db.insert(schema.files).values(newFile);

    return NextResponse.json(newFile, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  }
}

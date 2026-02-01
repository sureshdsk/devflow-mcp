import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const db = getDb();
    const projects = await db
      .select()
      .from(schema.projects)
      .orderBy(schema.projects.createdAt);
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const newProject = {
      id: randomUUID(),
      name,
      description: description || null,
      status: "active",
    };

    await db.insert(schema.projects).values(newProject);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const db = getDb();

    let features;
    if (projectId) {
      features = await db
        .select()
        .from(schema.features)
        .where(eq(schema.features.projectId, projectId))
        .orderBy(schema.features.order);
    } else {
      features = await db
        .select()
        .from(schema.features)
        .orderBy(schema.features.order);
    }

    return NextResponse.json(features);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, name, description } = body;

    if (!projectId || !name) {
      return NextResponse.json(
        { error: "Project ID and feature name are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const newFeature = {
      id: randomUUID(),
      projectId,
      name,
      description: description || null,
      status: "planning",
      order: 0,
    };

    await db.insert(schema.features).values(newFeature);

    return NextResponse.json(newFeature, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create feature" },
      { status: 500 }
    );
  }
}

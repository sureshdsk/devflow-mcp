import { NextResponse } from "next/server";
import { listSpecs, createSpec } from "@/lib/specs";
import { broadcastUpdate } from "@/mcp/websocket";
import { getDb, schema } from "@/db/index";

export async function GET() {
  try {
    // Read from DB first; fall back to disk scan for specs not yet in DB
    const db = await getDb();
    const dbSpecs = await db.select().from(schema.specs);

    if (dbSpecs.length > 0) {
      return NextResponse.json(dbSpecs);
    }

    const specs = await listSpecs();
    return NextResponse.json(specs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to list specs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, title, projectId, description, schema: schemaName } = body;

    if (!name || !title) {
      return NextResponse.json({ error: "name and title are required" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    await createSpec(name, title, projectId, description, schemaName);
    broadcastUpdate({ type: "spec_created", specName: name });
    return NextResponse.json({ name, title, projectId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create spec" },
      { status: 500 }
    );
  }
}

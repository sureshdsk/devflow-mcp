import { NextResponse } from "next/server";
import { parseTasksArtifact, getApprovals, getSpec } from "@/lib/specs";
import { getDb, schema } from "@/db";
import { randomUUID } from "crypto";
import { broadcastUpdate } from "@/mcp/websocket";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    const spec = await getSpec(name);
    const projectId = spec.projectId;
    if (!projectId) {
      return NextResponse.json(
        { error: "Spec has no project — re-create it with a projectId" },
        { status: 422 }
      );
    }

    // Check tasks artifact is approved
    const approvals = await getApprovals(name);
    if (approvals.artifacts["tasks"]?.state !== "approved") {
      return NextResponse.json(
        { error: "tasks artifact must be approved before promoting" },
        { status: 422 }
      );
    }

    const parsedTasks = await parseTasksArtifact(name);
    if (parsedTasks.length === 0) {
      return NextResponse.json(
        { error: "No tasks found in tasks.md" },
        { status: 422 }
      );
    }

    const db = await getDb();
    const newTasks = parsedTasks.map((task, index) => ({
      id: randomUUID(),
      projectId,
      specName: name,
      title: task.title,
      body: task.body || null,
      status: "backlog" as const,
      priority: (task.priority || "medium") as "low" | "medium" | "high" | "urgent",
      assignedAgent: null,
      order: index,
    }));

    await db.insert(schema.tasks).values(newTasks);
    broadcastUpdate({ type: "spec_promoted", specName: name, taskCount: newTasks.length });

    return NextResponse.json({ promoted: newTasks.length, tasks: newTasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to promote spec" },
      { status: 500 }
    );
  }
}

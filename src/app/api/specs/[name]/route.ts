import { NextResponse } from 'next/server';
import { getSpec } from '@/lib/specs';
import { getDb, schema } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const spec = await getSpec(name);

    // Synthesize "development" stage from promoted task statuses
    const tasksArtifactDone = spec.statuses.find((s) => s.id === 'tasks')?.state === 'done';
    let developmentState: 'blocked' | 'ready' | 'in_progress' | 'done' = 'blocked';

    // Check for promoted tasks in DB regardless of artifact approval state
    const db = await getDb();
    const tasks = await db
      .select({
        id: schema.tasks.id,
        title: schema.tasks.title,
        status: schema.tasks.status,
        assignedAgent: schema.tasks.assignedAgent,
        priority: schema.tasks.priority,
      })
      .from(schema.tasks)
      .where(eq(schema.tasks.specName, name));

    if (tasks.length > 0) {
      // Tasks have been promoted — derive state from task statuses
      if (tasks.every((t) => t.status === 'done')) {
        developmentState = 'done';
      } else if (tasks.some((t) => t.status === 'in_progress')) {
        developmentState = 'in_progress';
      } else {
        developmentState = 'ready';
      }
    } else if (tasksArtifactDone) {
      developmentState = 'ready'; // tasks artifact approved but not yet promoted
    }

    const developmentStatus = {
      id: 'development',
      state: developmentState,
      description: 'Implementation via check-in / check-out',
      requires: ['tasks'],
      fileExists: tasks.length > 0,
      approved: developmentState === 'done',
    };

    return NextResponse.json({
      ...spec,
      statuses: [...spec.statuses, developmentStatus],
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Spec not found' },
      { status: 404 },
    );
  }
}

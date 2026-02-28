import { Hono } from 'hono';
import {
  listSpecs,
  createSpec,
  getSpec,
  getArtifact,
  writeArtifact,
  getSpecStatus,
  getArtifactTemplate,
  approveArtifact,
  parseTasksArtifact,
  getApprovals,
} from '../../lib/specs';
import { broadcastUpdate } from '../../mcp/websocket';
import { getDb, schema } from '../../db/index';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const app = new Hono();

// GET /api/specs
app.get('/', async (c) => {
  try {
    const db = await getDb();
    const dbSpecs = await db.select().from(schema.specs);
    if (dbSpecs.length > 0) {
      return c.json(dbSpecs);
    }
    const specs = await listSpecs();
    return c.json(specs);
  } catch {
    return c.json({ error: 'Failed to list specs' }, 500);
  }
});

// POST /api/specs
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name, title, projectId, description, schema: schemaName } = body;

    if (!name || !title) {
      return c.json({ error: 'name and title are required' }, 400);
    }
    if (!projectId) {
      return c.json({ error: 'projectId is required' }, 400);
    }

    await createSpec(name, title, projectId, description, schemaName);
    broadcastUpdate({ type: 'spec_created', specName: name });
    return c.json({ name, title, projectId }, 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create spec' }, 500);
  }
});

// GET /api/specs/:name
app.get('/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const spec = await getSpec(name);

    const tasksArtifactDone = spec.statuses.find((s) => s.id === 'tasks')?.state === 'done';
    let developmentState: 'blocked' | 'ready' | 'in_progress' | 'done' = 'blocked';

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
      if (tasks.every((t) => t.status === 'done')) {
        developmentState = 'done';
      } else if (tasks.some((t) => t.status === 'in_progress')) {
        developmentState = 'in_progress';
      } else {
        developmentState = 'ready';
      }
    } else if (tasksArtifactDone) {
      developmentState = 'ready';
    }

    const developmentStatus = {
      id: 'development',
      state: developmentState,
      description: 'Implementation via check-in / check-out',
      requires: ['tasks'],
      fileExists: tasks.length > 0,
      approved: developmentState === 'done',
    };

    return c.json({
      ...spec,
      statuses: [...spec.statuses, developmentStatus],
      tasks,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Spec not found' }, 404);
  }
});

// GET /api/specs/:name/artifacts/:artifactType
app.get('/:name/artifacts/:artifactType', async (c) => {
  try {
    const name = c.req.param('name');
    const artifactType = c.req.param('artifactType');
    const template = c.req.query('template');

    if (template === 'true') {
      const tmpl = await getArtifactTemplate(name, artifactType);
      return c.json({ template: tmpl });
    }

    const content = await getArtifact(name, artifactType);
    if (content === null) {
      return c.json({ error: 'Artifact not found' }, 404);
    }
    return c.json({ content });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to get artifact' },
      500,
    );
  }
});

// PUT /api/specs/:name/artifacts/:artifactType
app.put('/:name/artifacts/:artifactType', async (c) => {
  try {
    const name = c.req.param('name');
    const artifactType = c.req.param('artifactType');

    const statuses = await getSpecStatus(name);
    const status = statuses.find((s) => s.id === artifactType);
    if (status?.state === 'blocked') {
      return c.json(
        { error: `Cannot write "${artifactType}": required artifacts not yet approved` },
        422,
      );
    }

    const body = await c.req.json();
    await writeArtifact(name, artifactType, body.content);
    broadcastUpdate({ type: 'artifact_updated', specName: name, artifactType });
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to write artifact' },
      500,
    );
  }
});

// POST /api/specs/:name/artifacts/:artifactType/approve
app.post('/:name/artifacts/:artifactType/approve', async (c) => {
  try {
    const name = c.req.param('name');
    const artifactType = c.req.param('artifactType');
    const body = await c.req.json();
    const approvedBy = body.approvedBy || 'human';

    await approveArtifact(name, artifactType, approvedBy);
    broadcastUpdate({ type: 'artifact_approved', specName: name, artifactType });
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to approve artifact' },
      422,
    );
  }
});

// POST /api/specs/:name/promote
app.post('/:name/promote', async (c) => {
  try {
    const name = c.req.param('name');

    const spec = await getSpec(name);
    const projectId = spec.projectId;
    if (!projectId) {
      return c.json({ error: 'Spec has no project — re-create it with a projectId' }, 422);
    }

    const approvals = await getApprovals(name);
    if (approvals.artifacts['tasks']?.state !== 'approved') {
      return c.json({ error: 'tasks artifact must be approved before promoting' }, 422);
    }

    const parsedTasks = await parseTasksArtifact(name);
    if (parsedTasks.length === 0) {
      return c.json({ error: 'No tasks found in tasks.md' }, 422);
    }

    const db = await getDb();
    const newTasks = parsedTasks.map((task, index) => ({
      id: randomUUID(),
      projectId,
      specName: name,
      title: task.title,
      body: task.body || null,
      status: 'backlog' as const,
      priority: (task.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      assignedAgent: null,
      order: index,
    }));

    await db.insert(schema.tasks).values(newTasks);
    broadcastUpdate({ type: 'spec_promoted', specName: name, taskCount: newTasks.length });

    return c.json({ promoted: newTasks.length, tasks: newTasks });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to promote spec' },
      500,
    );
  }
});

export default app;

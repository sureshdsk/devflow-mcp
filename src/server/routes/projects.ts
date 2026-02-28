import { Hono } from 'hono';
import { getDb, schema } from '../../db';
import { eq } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const db = await getDb();
    const projects = await db.select().from(schema.projects).orderBy(schema.projects.createdAt);
    return c.json(projects);
  } catch {
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = await getDb();

    const project = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (project.length === 0) {
      return c.json({ error: 'Project not found' }, 404);
    }

    const projectTasks = await db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, id));

    for (const task of projectTasks) {
      await db.delete(schema.agentActivity).where(eq(schema.agentActivity.taskId, task.id));
    }

    await db.delete(schema.tasks).where(eq(schema.tasks.projectId, id));
    await db.delete(schema.projects).where(eq(schema.projects.id, id));

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return c.json({ error: 'Failed to delete project', details: String(error) }, 500);
  }
});

app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    updateData.updatedAt = new Date();

    const db = await getDb();
    await db.update(schema.projects).set(updateData).where(eq(schema.projects.id, id));

    const updatedProject = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    return c.json(updatedProject[0]);
  } catch {
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

export default app;

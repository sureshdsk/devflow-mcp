import { Hono } from 'hono';
import { getDb, schema } from '../../db';
import { eq } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const db = await getDb();
    const tasks = await db.select().from(schema.tasks).orderBy(schema.tasks.order);
    return c.json(tasks);
  } catch {
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = await getDb();
    const task = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    if (task.length === 0) {
      return c.json({ error: 'Task not found' }, 404);
    }
    return c.json(task[0]);
  } catch {
    return c.json({ error: 'Failed to fetch task' }, 500);
  }
});

app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.body !== undefined) updateData.body = body.body;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.specName !== undefined) updateData.specName = body.specName;
    if (body.assignedAgent !== undefined) updateData.assignedAgent = body.assignedAgent;
    if (body.order !== undefined) updateData.order = body.order;
    updateData.updatedAt = new Date();

    const db = await getDb();
    await db.update(schema.tasks).set(updateData).where(eq(schema.tasks.id, id));

    const updatedTask = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, id))
      .limit(1);

    return c.json(updatedTask[0]);
  } catch {
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = await getDb();
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Failed to delete task' }, 500);
  }
});

export default app;

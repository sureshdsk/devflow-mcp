import { Hono } from 'hono';
import { getAgentCount, getAgentList } from '../../websocket/server';

const app = new Hono();

app.get('/', async (c) => {
  const agents = getAgentList();
  return c.json({ count: getAgentCount(), agents });
});

export default app;

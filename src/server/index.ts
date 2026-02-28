import { Hono } from 'hono';
import path from 'path';
import fs from 'fs';
import tasksRoutes from './routes/tasks';
import projectsRoutes from './routes/projects';
import specsRoutes from './routes/specs';
import agentsRoutes from './routes/agents';

const app = new Hono();

// API routes
app.route('/api/tasks', tasksRoutes);
app.route('/api/projects', projectsRoutes);
app.route('/api/specs', specsRoutes);
app.route('/api/agents', agentsRoutes);

// Static file serving + SPA fallback
// In production (tsup bundle), __dirname is dist/server/ → public is ../public
const publicDir = path.resolve(__dirname, '..', 'public');

app.get('*', async (c) => {
  const urlPath = new URL(c.req.url).pathname;

  // Try to serve static file
  const filePath = path.join(publicDir, urlPath);
  if (urlPath !== '/' && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);
    return new Response(content, {
      headers: { 'Content-Type': contentType },
    });
  }

  // SPA fallback — serve index.html
  const indexPath = path.join(publicDir, 'index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf-8');
    return c.html(html);
  } catch {
    return c.text('Not found', 404);
  }
});

export default app;

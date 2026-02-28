import { serve } from '@hono/node-server';
import app from './index';
import { startWebSocketServer } from '../websocket/server';

const port = parseInt(process.env.DEVFLOW_PORT || process.env.PORT || '3000', 10);
const wsPort = parseInt(process.env.DEVFLOW_WS_PORT || '3001', 10);

async function main() {
  // Start WebSocket server
  await startWebSocketServer(wsPort);

  // Start HTTP server
  serve({ fetch: app.fetch, port }, () => {
    console.log(`[DevFlow] HTTP server running on http://localhost:${port}`);
    console.log(`[DevFlow] WebSocket server running on ws://localhost:${wsPort}`);
  });
}

main().catch((err) => {
  console.error('[DevFlow] Failed to start:', err);
  process.exit(1);
});

import { WebSocketServer, WebSocket } from "ws";
import { createConnection } from "net";

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();
const agentClients = new Map<WebSocket, string>(); // ws → agent name

const DEFAULT_PORT = 3001;

function getPort(): number {
  const envPort = process.env.DEVFLOW_WS_PORT;
  if (envPort) {
    const parsed = parseInt(envPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed < 65536) {
      return parsed;
    }
  }
  return DEFAULT_PORT;
}

// Check if port is already in use by trying to connect
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = createConnection({ port }, () => {
      client.end();
      resolve(true);
    });
    client.on("error", () => {
      resolve(false);
    });
  });
}

export async function startWebSocketServer(port?: number): Promise<WebSocketServer | null> {
  if (wss) return wss;

  const wsPort = port ?? getPort();

  // Check if another instance is already running
  const inUse = await isPortInUse(wsPort);
  if (inUse) {
    console.log(`[WebSocket] Port ${wsPort} already in use, skipping server start`);
    return null;
  }

  try {
    wss = new WebSocketServer({ port: wsPort });

    wss.on("connection", (ws) => {
      clients.add(ws);
      console.log(`[WebSocket] Client connected (total: ${clients.size})`);

      ws.on("message", (data) => {
        try {
          const message = data.toString();
          const parsed = JSON.parse(message);

          // Identity handshake: MCP clients announce themselves
          if (parsed.type === "identify" && parsed.role === "mcp") {
            const agentName = parsed.agent || "Unknown Agent";
            agentClients.set(ws, agentName);
            console.log(`[WebSocket] MCP agent identified: ${agentName} (agents: ${agentClients.size})`);
            broadcastAgentList();
            return;
          }

          console.log("[WebSocket] Relaying message:", message.substring(0, 100));
          // Relay to all non-sender clients (browser UIs)
          clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          });
        } catch (error) {
          console.error("[WebSocket] Error relaying message:", error);
        }
      });

      ws.on("close", () => {
        const wasAgent = agentClients.has(ws);
        agentClients.delete(ws);
        clients.delete(ws);
        console.log(`[WebSocket] Client disconnected (total: ${clients.size})`);
        if (wasAgent) {
          console.log(`[WebSocket] MCP agent disconnected (agents: ${agentClients.size})`);
          broadcastAgentList();
        }
      });

      ws.on("error", (error) => {
        console.error("[WebSocket] Client error:", error);
        agentClients.delete(ws);
        clients.delete(ws);
      });
    });

    wss.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.log(`[WebSocket] Port ${wsPort} already in use, skipping`);
      } else {
        console.error("[WebSocket] Server error:", error);
      }
      wss = null;
    });

    console.log(`[WebSocket] Server started on port ${wsPort}`);
  } catch (error) {
    console.error("[WebSocket] Failed to start server:", error);
    return null;
  }

  return wss;
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

export function getClientCount(): number {
  return clients.size;
}

export function getAgentCount(): number {
  return agentClients.size;
}

export function getAgentList(): string[] {
  return Array.from(agentClients.values());
}

function broadcastAgentList() {
  const agents = getAgentList();
  const msg = JSON.stringify({ type: "agent_count", count: agents.length, agents });
  clients.forEach((client) => {
    if (!agentClients.has(client) && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

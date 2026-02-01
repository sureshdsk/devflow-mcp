import WebSocket from "ws";

let client: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;

const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
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

function getReconnectDelay(): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  return delay;
}

function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  const delay = getReconnectDelay();
  reconnectAttempts++;

  reconnectTimeout = setTimeout(() => {
    connectToServer();
  }, delay);
}

function connectToServer() {
  if (isConnecting || (client && client.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;
  const port = getPort();
  const url = `ws://localhost:${port}`;

  try {
    client = new WebSocket(url);

    client.on("open", () => {
      isConnecting = false;
      reconnectAttempts = 0;
      console.error(`[MCP WebSocket] Connected to server at ${url}`);
    });

    client.on("close", () => {
      isConnecting = false;
      client = null;
      // Only log and reconnect if we had been connected (reconnectAttempts > 0 means we're already trying)
      if (reconnectAttempts === 0) {
        console.error("[MCP WebSocket] Disconnected from server, will reconnect");
      }
      scheduleReconnect();
    });

    client.on("error", (error: Error & { code?: string }) => {
      isConnecting = false;
      // Only log connection refused once, not on every retry
      if (error.code === "ECONNREFUSED") {
        if (reconnectAttempts === 0) {
          console.error(
            `[MCP WebSocket] Server not available at ${url}, will retry in background`
          );
        }
      } else {
        console.error("[MCP WebSocket] Error:", error.message);
      }
      client = null;
      scheduleReconnect();
    });
  } catch (error) {
    isConnecting = false;
    console.error("[MCP WebSocket] Failed to create connection:", error);
    scheduleReconnect();
  }
}

export function broadcastUpdate(data: unknown) {
  if (!client || client.readyState !== WebSocket.OPEN) {
    // Server not available, silently fail - UI has polling fallback
    console.error("[MCP WebSocket] Not connected, skipping broadcast:", JSON.stringify(data).substring(0, 100));
    return;
  }

  try {
    const message = JSON.stringify(data);
    console.error("[MCP WebSocket] Broadcasting:", message.substring(0, 100));
    client.send(message);
  } catch (error) {
    console.error("[MCP WebSocket] Failed to send message:", error);
  }
}

export function isConnected(): boolean {
  return client !== null && client.readyState === WebSocket.OPEN;
}

export function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (client) {
    client.close();
    client = null;
  }
}

// Attempt initial connection when module is imported
connectToServer();

export async function register() {
  // Only run on Node.js server, not during build or on edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWebSocketServer } = await import("./src/websocket/server");
    const port = process.env.DEVFLOW_WS_PORT
      ? parseInt(process.env.DEVFLOW_WS_PORT, 10)
      : 3001;
    await startWebSocketServer(port);
  }
}

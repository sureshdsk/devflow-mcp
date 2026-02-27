# Local Development Guide

## Prerequisites

- Node.js 20+
- Bun 1.0+ (required for the MCP server)

## Build & Install Locally

### 1. Clone & install dependencies

```bash
git clone https://github.com/sureshdsk/devflow-mcp.git
cd devflow-mcp
npm install
```

### 2. Build

```bash
npm run build
```

This runs `next build` and produces the `.next/standalone` output.

### 3. Install globally (link)

```bash
npm link
```

This symlinks the package globally, making `devflow` and `devflow-mcp` commands available in your terminal.

### 4. Use it

```bash
devflow init          # Initialize the database
devflow dev           # Start the web UI (default port 3000)
devflow mcp           # Start the MCP server
```

### Development mode (hot reload)

```bash
npm run dev
```

Starts Next.js dev server with hot reload on port 3000.

### Custom ports

```bash
DEVFLOW_PORT=4000 DEVFLOW_WS_PORT=4001 devflow dev
```

## Uninstall

```bash
# From the project directory
npm unlink
```

Or if that doesn't work:

```bash
npm unlink -g @sureshdsk/devflow-mcp
```

To verify it's removed:

```bash
which devflow  # should return nothing
```

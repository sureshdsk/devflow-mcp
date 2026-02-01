#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Detect if Bun is available
function hasBun() {
  try {
    execSync('bun --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

const command = process.argv[2];

switch (command) {
  case 'init':
    console.log('Initializing DevFlow database...');
    const initScript = path.join(__dirname, '..', 'scripts', hasBun() ? 'init-db.ts' : 'init-db.js');
    const initCmd = hasBun() ? 'bun' : 'node';
    const initArgs = hasBun() ? ['run', initScript] : [initScript];
    const initProcess = spawn(initCmd, initArgs, { stdio: 'inherit' });
    initProcess.on('exit', (code) => process.exit(code));
    break;

  case 'dev':
    console.log('Starting DevFlow web UI...');
    const pkgDir = path.join(__dirname, '..');
    const nextBin = path.join(pkgDir, 'node_modules', '.bin', 'next');
    const devProcess = spawn(nextBin, ['start'], {
      stdio: 'inherit',
      cwd: pkgDir
    });
    devProcess.on('exit', (code) => process.exit(code));
    break;

  case 'mcp':
    console.log('Starting DevFlow MCP server...');
    if (!hasBun()) {
      console.error('Error: Bun is required for the MCP server');
      console.error('Please install Bun: https://bun.sh');
      console.error('\nAlternatively, you can use the web UI with Node.js:');
      console.error('  devflow dev');
      process.exit(1);
    }
    const mcpScript = path.join(__dirname, '..', 'src', 'mcp', 'server.ts');
    const mcpProcess = spawn('bun', ['run', mcpScript], { stdio: 'inherit' });
    mcpProcess.on('exit', (code) => process.exit(code));
    break;

  case 'help':
  case '--help':
  case '-h':
  default:
    console.log(`
DevFlow MCP - Context-First Kanban for AI Agents

Usage:
  devflow init        Initialize the database
  devflow dev         Start the web UI and WebSocket server (http://localhost:3000)
  devflow mcp         Start the MCP server for AI agents (requires Bun)
  devflow help        Show this help message

Requirements:
  - Web UI: Node.js 20+ or Bun 1.0+
  - MCP Server: Bun 1.0+ (required for AI agent integration)

Architecture:
  - devflow dev     Starts web UI on :3000 AND WebSocket server on :3001
  - devflow mcp     Connects TO the WebSocket server for real-time updates
                    (if web UI not running, MCP still works, updates won't be real-time)

Environment Variables:
  DEVFLOW_WS_PORT   WebSocket server port (default: 3001)

Examples:
  # First time setup
  devflow init

  # Start the web UI (works with Node.js or Bun)
  devflow dev

  # Start the MCP server (requires Bun)
  devflow mcp

For more information, visit: https://github.com/yourusername/devflow-mcp
    `);
    process.exit(command === 'help' || command === '--help' || command === '-h' ? 0 : 1);
}

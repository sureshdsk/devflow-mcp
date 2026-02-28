#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const command = process.argv[2];
const subcommand = process.argv[3];

switch (command) {
  case 'init': {
    console.log('Initializing DevFlow database...');
    const initScript = path.join(__dirname, '..', 'scripts', 'init-db.js');
    const initArgs = process.argv.slice(3);
    const initProcess = spawn('node', [initScript, ...initArgs], { stdio: 'inherit' });
    initProcess.on('exit', (code) => {
      if (code !== 0) process.exit(code);
      // Install skills and commands after DB init
      const { installSkills, printReport } = require(
        path.join(__dirname, '..', 'scripts', 'install-skills.js'),
      );
      console.log('\nInstalling skills and slash commands...');
      const report = installSkills(process.cwd(), {});
      printReport(report);
      console.log('\n✅ DevFlow initialized.');
    });
    break;
  }

  case 'tool': {
    const { installSkills, printReport } = require(
      path.join(__dirname, '..', 'scripts', 'install-skills.js'),
    );
    if (subcommand === 'install' || subcommand === 'update') {
      const args = process.argv.slice(4);
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--tools') options.tools = args[++i];
        else if (args[i] === '--only') options.only = args[++i];
        else if (args[i] === '--no-autodetect') options.autodetect = false;
        else if (args[i] === '--dry-run') options.dryRun = true;
        else if (args[i] === '--delivery') options.delivery = args[++i];
        else if (args[i] === '--force') options.force = true;
      }
      if (subcommand === 'update') {
        options.force = true;
        if (options.autodetect === undefined) options.autodetect = false;
        if (options.only === undefined && options.tools === undefined) options.tools = 'all';
      }
      console.log(
        `${subcommand === 'update' ? 'Updating' : 'Installing'} DevFlow skills and slash commands...`,
      );
      const report = installSkills(process.cwd(), options);
      printReport(report);
    } else {
      console.log(`
Usage:
  devflow tool install [--tools all|codex|claudecode] [--only codex|claudecode] [--no-autodetect] [--dry-run] [--delivery both|skills|commands]
  devflow tool update  [--tools all|codex|claudecode] [--only codex|claudecode] [--dry-run] [--delivery both|skills|commands]

Examples:
  devflow tool install                   # autodetect installed tools and install
  devflow tool install --no-autodetect   # install for all supported tools
  devflow tool install --only codex      # install for Codex only
  devflow tool install --tools codex     # install for Codex only
  devflow tool install --dry-run         # preview actions without writing
  devflow tool update                    # re-write all managed sections
      `);
    }
    break;
  }

  case 'dev': {
    console.log('Starting DevFlow web UI...');
    const pkgDir = path.join(__dirname, '..');
    const serverEntry = path.join(pkgDir, 'dist', 'server', 'start.js');
    if (fs.existsSync(serverEntry)) {
      const devProcess = spawn('node', [serverEntry], {
        stdio: 'inherit',
        cwd: pkgDir,
        env: { ...process.env, PORT: process.env.DEVFLOW_PORT || process.env.PORT || '3000' },
      });
      devProcess.on('exit', (code) => process.exit(code));
    } else {
      // Fallback: run with tsx in development
      const tsxBin = path.join(pkgDir, 'node_modules', '.bin', 'tsx');
      const srcEntry = path.join(pkgDir, 'src', 'server', 'start.ts');
      const devProcess = spawn(tsxBin, [srcEntry], {
        stdio: 'inherit',
        cwd: pkgDir,
        env: { ...process.env, PORT: process.env.DEVFLOW_PORT || process.env.PORT || '3000' },
      });
      devProcess.on('exit', (code) => process.exit(code));
    }
    break;
  }

  case 'mcp': {
    const pkgDir = path.join(__dirname, '..');
    const tsxBin = path.join(pkgDir, 'node_modules', '.bin', 'tsx');
    const mcpScript = path.join(pkgDir, 'src', 'mcp', 'server.ts');
    const mcpProcess = spawn(tsxBin, [mcpScript], { stdio: 'inherit' });
    mcpProcess.on('exit', (code) => process.exit(code));
    break;
  }

  case 'help':
  case '--help':
  case '-h':
  default:
    console.log(`
DevFlow MCP - Spec-Driven Kanban for AI Agents

Usage:
  devflow init [--schema ID] [--non-interactive]
                                  Initialize database, choose default schema, and install skills/commands
  devflow tool install            Install skills and slash commands for AI tools
  devflow tool update             Update existing skills and slash commands
  devflow dev                     Start the web UI (http://localhost:3000)
  devflow mcp                     Start the MCP server for AI agents
  devflow help                    Show this help message

Tool install options:
  --tools all|codex|claudecode    Explicit tool selection (overrides autodetect)
  --only codex|claudecode         Restrict install to a single tool
  --no-autodetect                 Disable autodetect and target all supported tools
  --dry-run                       Preview installation without writing files
  --delivery both|skills|commands What to install (default: both)
  --force                         Legacy compatibility flag (managed updates remain safe)

Init options:
  --schema <id>                   Set default schema template explicitly
  --non-interactive               Disable prompts and use deterministic fallback

Requirements:
  - Node.js 20+

Environment Variables:
  DEVFLOW_PORT      Web UI port (default: 3000)
  DEVFLOW_WS_PORT   WebSocket server port (default: 3001)
  CODEX_HOME        Override Codex home directory (default: ~/.codex)

Examples:
  devflow init
  devflow tool install --tools codex
  devflow tool update
  devflow dev
  devflow mcp
    `);
    process.exit(command === 'help' || command === '--help' || command === '-h' ? 0 : 1);
}

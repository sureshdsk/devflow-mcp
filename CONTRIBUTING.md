# Contributing to DevFlow MCP

Thank you for your interest in contributing to DevFlow MCP! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/devflow-mcp/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Bun version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check [Discussions](https://github.com/yourusername/devflow-mcp/discussions) for similar ideas
2. Create a new discussion with:
   - Clear use case
   - Proposed solution
   - Alternative approaches considered
   - Impact on existing functionality

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/devflow-mcp.git
   cd devflow-mcp
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the code style guidelines below
   - Add tests for new functionality
   - Update documentation as needed

4. **Test your changes**
   ```bash
   bun install
   bun typecheck
   bun lint
   bun test  # when tests are added
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Adding or updating tests
   - `chore:` Maintenance tasks

6. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub.

## Development Setup

### Prerequisites

- Bun v1.0+
- Node.js 20+
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/devflow-mcp.git
cd devflow-mcp

# Install dependencies
bun install

# Initialize database
bun run db:init

# Start development
bun dev  # Web UI
bun run mcp  # MCP server
```

### Project Structure

```
devflow-mcp/
├── src/
│   ├── app/           # Next.js app (web UI)
│   ├── components/    # React components
│   ├── db/            # Database schema and connection
│   ├── mcp/           # MCP server implementation
│   └── lib/           # Utility functions
├── scripts/           # Build and setup scripts
├── drizzle/           # Database migrations
├── bin/               # CLI entry points
└── docs/              # Documentation
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types
- Use interfaces for object shapes
- Use type aliases for unions/intersections

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript for props
- Follow the "use client" directive pattern

```tsx
"use client";

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return <div onClick={onAction}>{title}</div>;
}
```

### Database

- Use Drizzle ORM for all database operations
- Create migrations for schema changes
- Never modify existing migrations
- Use transactions for multi-step operations

### MCP Tools

- Follow the existing tool pattern
- Provide clear descriptions
- Use proper input validation
- Return structured JSON responses
- Handle errors gracefully

```typescript
case "my_tool": {
  const { param } = request.params.arguments as { param: string };
  
  // Validate input
  if (!param) {
    throw new Error("param is required");
  }
  
  // Perform operation
  const result = await db.select()...;
  
  // Return structured response
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}
```

## Testing

### Manual Testing

1. Test the web UI:
   ```bash
   bun dev
   ```
   - Create projects, features, tasks
   - Test drag and drop
   - Verify real-time updates

2. Test the MCP server:
   ```bash
   bun run mcp
   ```
   - Use Claude Desktop or Cursor
   - Test each tool
   - Verify error handling

### Automated Testing (Coming Soon)

We're working on adding:
- Unit tests with Vitest
- Integration tests for MCP tools
- E2E tests with Playwright

## Documentation

### Code Comments

- Add JSDoc comments for public APIs
- Explain complex logic
- Document assumptions and constraints

```typescript
/**
 * Creates a new task in the specified project
 * @param projectId - The project to add the task to
 * @param title - Task title
 * @returns The created task with generated ID
 */
async function createTask(projectId: string, title: string) {
  // ...
}
```

### README Updates

- Update README.md for user-facing changes
- Update SETUP.md for configuration changes
- Add examples for new features

## Database Migrations

### Creating a Migration

```bash
# 1. Update src/db/schema.ts
# 2. Generate migration
bun run db:generate

# 3. Test migration
rm ~/.devflow/devflow.db
bun run db:init

# 4. Verify schema
bun run db:studio
```

### Migration Guidelines

- One logical change per migration
- Test both up and down migrations
- Include data migrations if needed
- Document breaking changes

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag
4. Push to GitHub
5. Publish to npm (maintainers only)

## Questions?

- Open a [Discussion](https://github.com/yourusername/devflow-mcp/discussions)
- Join our [Discord](https://discord.gg/devflow)
- Email: devflow@example.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

import { afterEach, describe, expect, test } from "bun:test";
import fs from "fs";
import os from "os";
import path from "path";
import { listSchemas, loadSchema } from "./schema";

const tempDirs: string[] = [];

function makeTempProject(): { root: string; projectDir: string; specsDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devflow-schema-test-"));
  tempDirs.push(root);
  const projectDir = path.join(root, "devflow");
  const specsDir = path.join(projectDir, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  return { root, projectDir, specsDir };
}

function writeSchema(projectDir: string, name: string): void {
  const schemaDir = path.join(projectDir, "schemas", name);
  fs.mkdirSync(path.join(schemaDir, "templates"), { recursive: true });
  fs.writeFileSync(
    path.join(schemaDir, "schema.yaml"),
    [
      `name: ${name}`,
      "version: 1",
      "artifacts:",
      "  - id: proposal",
      "    generates: proposal.md",
      "    description: Proposal",
      "    template: proposal.md",
      "    requires: []",
    ].join("\n"),
    "utf-8"
  );
  fs.writeFileSync(path.join(schemaDir, "templates", "proposal.md"), "# Proposal", "utf-8");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("schema registry", () => {
  test("includes all bundled built-in schema IDs", async () => {
    const { specsDir } = makeTempProject();
    const entries = await listSchemas(specsDir);
    const ids = entries.map((entry) => entry.id);
    expect(ids).toContain("spec-driven");
    expect(ids).toContain("frontend-product");
    expect(ids).toContain("backend-api");
    expect(ids).toContain("data-engineering");
    expect(ids).toContain("devops-platform");
  });

  test("loads project-local custom schema when present", async () => {
    const { projectDir, specsDir } = makeTempProject();
    writeSchema(projectDir, "custom-team");
    const schema = await loadSchema("custom-team", specsDir);
    expect(schema.name).toBe("custom-team");
  });

  test("throws actionable error for unknown schema", async () => {
    const { specsDir } = makeTempProject();
    await expect(loadSchema("missing-schema", specsDir)).rejects.toThrow(
      'Schema "missing-schema" not found. Available schemas:'
    );
  });

  test("fails fast on ID conflict between bundled and project schemas", async () => {
    const { projectDir, specsDir } = makeTempProject();
    writeSchema(projectDir, "spec-driven");
    await expect(listSchemas(specsDir)).rejects.toThrow('Schema ID conflict for "spec-driven"');
  });
});

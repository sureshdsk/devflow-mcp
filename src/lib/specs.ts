import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import {
  getSpecsDir,
  getSpecDir,
  getApprovalsPath,
  getMetaPath,
  getArtifactPath,
} from "./specs-dir";
import {
  loadSchema,
  computeSpecStatus,
  resolveTemplate,
  type ApprovalsFile,
  type ArtifactStatus,
  type Schema,
} from "./schema";
import { getDb, schema as dbSchema } from "../db/index";

export interface SpecMeta {
  name: string;
  title: string;
  description?: string;
  projectId: string;
  schema: string;
  createdAt: string;
}

export interface SpecDetail extends SpecMeta {
  artifacts: Record<string, string | null>;
  statuses: ArtifactStatus[];
  approvals: ApprovalsFile;
}

export interface ParsedTask {
  title: string;
  priority: string;
  body: string;
}

export interface ValidationFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface ValidationReport {
  ok: boolean;
  findings: ValidationFinding[];
}

function defaultApprovals(schema: Schema): ApprovalsFile {
  const artifacts: Record<string, { state: "draft" }> = {};
  for (const artifact of schema.artifacts) {
    artifacts[artifact.id] = { state: "draft" };
  }
  return { version: 1, artifacts };
}

async function getSchema(specName: string): Promise<Schema> {
  const metaPath = getMetaPath(specName);
  let schemaName = "spec-driven";
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    schemaName = meta.schema || "spec-driven";
  }
  return loadSchema(schemaName, getSpecsDir());
}

export async function listSpecs(): Promise<SpecMeta[]> {
  const specsDir = getSpecsDir();
  if (!fs.existsSync(specsDir)) return [];

  const entries = fs.readdirSync(specsDir, { withFileTypes: true });
  const specs: SpecMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "archive") continue;
    const metaPath = path.join(specsDir, entry.name, ".meta.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      specs.push({ name: entry.name, ...meta });
    }
  }

  return specs;
}

export async function getSpec(specName: string): Promise<SpecDetail> {
  const metaPath = getMetaPath(specName);
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Spec "${specName}" not found`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as SpecMeta;
  const schema = await loadSchema(meta.schema || "spec-driven", getSpecsDir());
  const approvals = await getApprovals(specName);

  const artifacts: Record<string, string | null> = {};
  const artifactFiles: Record<string, boolean> = {};

  for (const artifact of schema.artifacts) {
    const artifactPath = getArtifactPath(specName, artifact.id);
    if (fs.existsSync(artifactPath)) {
      artifacts[artifact.id] = fs.readFileSync(artifactPath, "utf-8");
      artifactFiles[artifact.id] = true;
    } else {
      artifacts[artifact.id] = null;
      artifactFiles[artifact.id] = false;
    }
  }

  const statuses = computeSpecStatus(schema, approvals, artifactFiles);

  return {
    ...meta,
    name: specName,
    artifacts,
    statuses,
    approvals,
  };
}

export async function getArtifact(specName: string, artifactType: string): Promise<string | null> {
  const artifactPath = getArtifactPath(specName, artifactType);
  if (!fs.existsSync(artifactPath)) return null;
  return fs.readFileSync(artifactPath, "utf-8");
}

export async function writeArtifact(
  specName: string,
  artifactType: string,
  content: string
): Promise<void> {
  const specDir = getSpecDir(specName);
  if (!fs.existsSync(specDir)) {
    throw new Error(`Spec "${specName}" not found`);
  }

  const artifactPath = getArtifactPath(specName, artifactType);
  fs.writeFileSync(artifactPath, content, "utf-8");

  // Auto-invalidate: if was approved, reset to draft
  const approvals = await getApprovals(specName);
  const existing = approvals.artifacts[artifactType];
  if (existing?.state === "approved") {
    approvals.artifacts[artifactType] = { state: "draft" };
    await writeApprovals(specName, approvals);
  }
}

export async function getApprovals(specName: string): Promise<ApprovalsFile> {
  const approvalsPath = getApprovalsPath(specName);
  if (!fs.existsSync(approvalsPath)) {
    const schema = await getSchema(specName);
    return defaultApprovals(schema);
  }
  return JSON.parse(fs.readFileSync(approvalsPath, "utf-8")) as ApprovalsFile;
}

export async function writeApprovals(specName: string, approvals: ApprovalsFile): Promise<void> {
  const approvalsPath = getApprovalsPath(specName);
  fs.writeFileSync(approvalsPath, JSON.stringify(approvals, null, 2), "utf-8");
}

export async function approveArtifact(
  specName: string,
  artifactType: string,
  approvedBy: string
): Promise<void> {
  const schema = await getSchema(specName);
  const artifactDef = schema.artifacts.find((a) => a.id === artifactType);
  if (!artifactDef) throw new Error(`Unknown artifact type: ${artifactType}`);

  const approvals = await getApprovals(specName);

  // Check blockers
  for (const req of artifactDef.requires) {
    const reqApproval = approvals.artifacts[req];
    if (!reqApproval || reqApproval.state !== "approved") {
      throw new Error(`Cannot approve "${artifactType}": "${req}" must be approved first`);
    }
  }

  const content = await getArtifact(specName, artifactType);
  if (!content) {
    throw new Error(`Cannot approve "${artifactType}": file does not exist`);
  }

  const contentHash = createHash("sha256").update(content).digest("hex");
  approvals.artifacts[artifactType] = {
    state: "approved",
    approvedAt: new Date().toISOString(),
    contentHash,
    approvedBy,
  };

  await writeApprovals(specName, approvals);
}

export async function draftArtifact(specName: string, artifactType: string): Promise<void> {
  const approvals = await getApprovals(specName);
  approvals.artifacts[artifactType] = { state: "draft" };
  await writeApprovals(specName, approvals);
}

export async function getSpecStatus(specName: string): Promise<ArtifactStatus[]> {
  const schema = await getSchema(specName);
  const approvals = await getApprovals(specName);
  const artifactFiles: Record<string, boolean> = {};

  for (const artifact of schema.artifacts) {
    const artifactPath = getArtifactPath(specName, artifact.id);
    artifactFiles[artifact.id] = fs.existsSync(artifactPath);
  }

  return computeSpecStatus(schema, approvals, artifactFiles);
}

const PRIORITY_MAP: Record<string, string> = {
  p0: "high",
  p1: "medium",
  p2: "low",
};

function normalizePriority(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return PRIORITY_MAP[lower] || lower;
}

export async function parseTasksArtifact(specName: string): Promise<ParsedTask[]> {
  const content = await getArtifact(specName, "tasks");
  if (!content) return [];

  const taskHeaderRegex = /^#{2,4}\s+\d*\.?\d*\s*Task:\s*(.+)/m;
  const blocks = content.split(/(?=^#{2,4}\s+\d*\.?\d*\s*Task:\s*)/m).filter((b) =>
    taskHeaderRegex.test(b)
  );

  const tasks: ParsedTask[] = [];

  for (const block of blocks) {
    const headerMatch = block.match(taskHeaderRegex);
    if (!headerMatch) continue;

    const title = headerMatch[1].trim();

    // Extract priority from **Priority:** metadata line
    let priority = "medium";
    const priorityMatch = block.match(/^\*\*Priority:\*\*\s*(.+)$/m);
    if (priorityMatch) {
      priority = normalizePriority(priorityMatch[1]);
    } else {
      // Fallback: plain Priority: line
      const plainPriorityMatch = block.match(/^Priority:\s*(.+)$/im);
      if (plainPriorityMatch) {
        priority = normalizePriority(plainPriorityMatch[1]);
      }
    }

    tasks.push({ title, priority, body: block.trimEnd() });
  }

  return tasks;
}

export function fillTaskSummary(
  body: string,
  summary: {
    whatWasDone: string;
    filesChanged?: string;
    issuesEncountered?: string;
    followUps?: string;
  }
): string {
  let result = body;

  // Replace the entire Task Summary section lines with filled values.
  // Handles both "- Key: <!-- placeholder -->" and bare "<!-- placeholder -->" patterns.
  result = result.replace(
    /^(- Completed:)\s*<!--.*?-->/gim,
    `$1 yes`
  );
  result = result.replace(
    /^(- What was done:)\s*<!--.*?-->/gim,
    `$1 ${summary.whatWasDone}`
  );
  result = result.replace(
    /^(- Files changed:)\s*<!--.*?-->/gim,
    `$1 ${summary.filesChanged ?? "N/A"}`
  );
  result = result.replace(
    /^(- Issues encountered:)\s*<!--.*?-->/gim,
    `$1 ${summary.issuesEncountered ?? "None"}`
  );
  result = result.replace(
    /^(- Follow-ups:)\s*<!--.*?-->/gim,
    `$1 ${summary.followUps ?? "None"}`
  );

  // Fallback: bare <!-- what was done --> style comments (legacy)
  result = result.replace(/<!--\s*what was done\s*-->/gi, summary.whatWasDone);
  result = result.replace(/<!--\s*files changed\s*-->/gi, summary.filesChanged ?? "N/A");
  result = result.replace(/<!--\s*issues encountered\s*-->/gi, summary.issuesEncountered ?? "None");
  result = result.replace(/<!--\s*follow.?ups?\s*-->/gi, summary.followUps ?? "None");

  return result;
}

export async function updateTaskBodyInSpec(
  specName: string,
  taskTitle: string,
  newBody: string
): Promise<void> {
  try {
    const artifactPath = getArtifactPath(specName, "tasks");
    if (!fs.existsSync(artifactPath)) return;

    const content = fs.readFileSync(artifactPath, "utf-8");
    const taskHeaderRegex = /^#{2,4}\s+\d*\.?\d*\s*Task:\s*(.+)/m;

    // Split into blocks
    const parts = content.split(/(?=^#{2,4}\s+\d*\.?\d*\s*Task:\s*)/m);
    let replaced = false;
    const newParts = parts.map((part) => {
      if (replaced) return part;
      const match = part.match(taskHeaderRegex);
      if (match && match[1].trim() === taskTitle) {
        replaced = true;
        return newBody + (part.endsWith("\n") ? "\n" : "");
      }
      return part;
    });

    if (!replaced) return;

    const newContent = newParts.join("");
    fs.writeFileSync(artifactPath, newContent, "utf-8");

    // Reset approval to draft
    const approvals = await getApprovals(specName);
    const existing = approvals.artifacts["tasks"];
    if (existing?.state === "approved") {
      approvals.artifacts["tasks"] = { state: "draft" };
      await writeApprovals(specName, approvals);
    }
  } catch {
    // Best-effort — fail silently
  }
}

export async function createSpec(
  specName: string,
  title: string,
  projectId: string,
  description?: string,
  schemaName = "spec-driven"
): Promise<void> {
  const specDir = getSpecDir(specName);
  if (fs.existsSync(specDir)) {
    throw new Error(`Spec "${specName}" already exists`);
  }

  fs.mkdirSync(specDir, { recursive: true });

  const meta: SpecMeta = {
    name: specName,
    title,
    description,
    projectId,
    schema: schemaName,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(getMetaPath(specName), JSON.stringify(meta, null, 2), "utf-8");

  const artifactSchema = await loadSchema(schemaName, getSpecsDir());
  await writeApprovals(specName, defaultApprovals(artifactSchema));

  // Insert DB row
  const db = await getDb();
  await db.insert(dbSchema.specs).values({
    name: specName,
    projectId,
    title,
    description: description ?? null,
    schema: schemaName,
    status: "active",
    createdAt: new Date(),
  });
}

export async function validateSpec(specName: string): Promise<ValidationReport> {
  const findings: ValidationFinding[] = [];
  const schema = await getSchema(specName);
  const approvals = await getApprovals(specName);

  for (const artifact of schema.artifacts) {
    const content = await getArtifact(specName, artifact.id);
    if (!content) {
      findings.push({
        code: "ARTIFACT_MISSING",
        severity: "error",
        message: `Artifact "${artifact.id}" has not been created yet`,
      });
      continue;
    }

    const approval = approvals.artifacts[artifact.id];
    if (!approval || approval.state !== "approved") {
      findings.push({
        code: "ARTIFACT_NOT_APPROVED",
        severity: "error",
        message: `Artifact "${artifact.id}" exists but has not been approved`,
      });
    }

    if (artifact.id === "tasks") {
      const parsedTasks = await parseTasksArtifact(specName);
      if (parsedTasks.length === 0) {
        findings.push({
          code: "TASKS_EMPTY",
          severity: "error",
          message: 'tasks.md has no parseable "## Task:" entries',
        });
      }
    }

    if (artifact.id === "specs" && content) {
      if (!content.includes("### Requirement:")) {
        findings.push({
          code: "SPEC_NO_REQUIREMENTS",
          severity: "warning",
          message: 'specs.md has no "### Requirement:" headings',
        });
      }
      if (!content.includes("#### Scenario:")) {
        findings.push({
          code: "SPEC_NO_SCENARIOS",
          severity: "warning",
          message: 'specs.md has no "#### Scenario:" headings',
        });
      }
    }
  }

  return { ok: findings.filter((f) => f.severity === "error").length === 0, findings };
}

export async function archiveSpec(specName: string): Promise<void> {
  const specDir = getSpecDir(specName);
  if (!fs.existsSync(specDir)) {
    throw new Error(`Spec "${specName}" not found`);
  }

  const archiveDir = path.join(getSpecsDir(), "archive");
  fs.mkdirSync(archiveDir, { recursive: true });

  const archiveDest = path.join(archiveDir, specName);
  fs.renameSync(specDir, archiveDest);

  // Update DB status
  const db = await getDb();
  const { eq } = await import("drizzle-orm");
  await db.update(dbSchema.specs).set({ status: "archived" }).where(eq(dbSchema.specs.name, specName));
}

export async function getArtifactTemplate(
  specName: string,
  artifactId: string
): Promise<string> {
  const schema = await getSchema(specName);
  return resolveTemplate(schema, artifactId, getSpecsDir());
}

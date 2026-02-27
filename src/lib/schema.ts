import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface ArtifactDef {
  id: string;
  generates: string;
  description: string;
  template: string;
  requires: string[];
}

export interface Schema {
  name: string;
  version: number;
  artifacts: ArtifactDef[];
  qualityRules?: {
    requireRfc2119?: boolean;
    minScenariosPerRequirement?: number;
  };
  apply?: {
    requires: string[];
  };
}

export type SchemaSource = 'bundled' | 'project';

export interface SchemaRegistryEntry {
  id: string;
  source: SchemaSource;
  schemaPath: string;
  templatesDir: string;
  schema: Schema;
}

export interface ApprovalsFile {
  version: number;
  artifacts: Record<string, ArtifactApproval>;
}

export interface ArtifactApproval {
  state: 'draft' | 'approved';
  approvedAt?: string;
  contentHash?: string;
  approvedBy?: string;
}

export type ArtifactStatusState = 'blocked' | 'ready' | 'in_review' | 'done';

export interface ArtifactStatus {
  id: string;
  state: ArtifactStatusState;
  description: string;
  requires: string[];
  fileExists: boolean;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

const BUNDLED_SCHEMAS_DIR = path.join(process.cwd(), 'src', 'schemas');

function parseSchemaFile(schemaPath: string): Schema {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  return yaml.load(content) as Schema;
}

function readSchemaEntriesFromDir(baseDir: string, source: SchemaSource): SchemaRegistryEntry[] {
  if (!fs.existsSync(baseDir)) return [];
  const dirs = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const entries: SchemaRegistryEntry[] = [];
  for (const dirName of dirs) {
    const schemaPath = path.join(baseDir, dirName, 'schema.yaml');
    if (!fs.existsSync(schemaPath)) continue;
    const schema = parseSchemaFile(schemaPath);
    if (!schema?.name) {
      throw new Error(`Invalid schema at ${schemaPath}: missing "name"`);
    }
    entries.push({
      id: schema.name,
      source,
      schemaPath,
      templatesDir: path.join(path.dirname(schemaPath), 'templates'),
      schema,
    });
  }
  return entries;
}

export async function listSchemas(specsDir: string): Promise<SchemaRegistryEntry[]> {
  const projectSchemasDir = path.join(path.dirname(specsDir), 'schemas');
  const bundledEntries = readSchemaEntriesFromDir(BUNDLED_SCHEMAS_DIR, 'bundled');
  const projectEntries = readSchemaEntriesFromDir(projectSchemasDir, 'project');

  const idToEntry = new Map<string, SchemaRegistryEntry>();
  for (const entry of [...bundledEntries, ...projectEntries]) {
    const existing = idToEntry.get(entry.id);
    if (existing) {
      throw new Error(
        `Schema ID conflict for "${entry.id}" between ${existing.source}:${existing.schemaPath} and ${entry.source}:${entry.schemaPath}`,
      );
    }
    idToEntry.set(entry.id, entry);
  }

  return [...idToEntry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function loadSchema(schemaName: string, specsDir: string): Promise<Schema> {
  const entries = await listSchemas(specsDir);
  const entry = entries.find((schema) => schema.id === schemaName);
  if (!entry) {
    const available = entries.map((schema) => schema.id).join(', ');
    throw new Error(
      available.length > 0
        ? `Schema "${schemaName}" not found. Available schemas: ${available}`
        : `Schema "${schemaName}" not found`,
    );
  }

  return entry.schema;
}

export async function resolveTemplate(
  schema: Schema,
  artifactId: string,
  specsDir: string,
): Promise<string> {
  const artifact = schema.artifacts.find((a) => a.id === artifactId);
  if (!artifact) throw new Error(`Artifact "${artifactId}" not found in schema`);

  // 1. Try project-local template
  const localTemplatePath = path.join(
    path.dirname(specsDir),
    'schemas',
    schema.name,
    'templates',
    artifact.template,
  );
  if (fs.existsSync(localTemplatePath)) {
    return fs.readFileSync(localTemplatePath, 'utf-8');
  }

  // 2. Try bundled template
  const bundledTemplatePath = path.join(
    BUNDLED_SCHEMAS_DIR,
    schema.name,
    'templates',
    artifact.template,
  );
  if (fs.existsSync(bundledTemplatePath)) {
    return fs.readFileSync(bundledTemplatePath, 'utf-8');
  }

  return `# ${artifactId}\n\n<!-- Write your ${artifactId} here -->\n`;
}

export function getArtifactBlockers(schema: Schema): Record<string, string[]> {
  const blockers: Record<string, string[]> = {};
  for (const artifact of schema.artifacts) {
    blockers[artifact.id] = artifact.requires;
  }
  return blockers;
}

export function computeSpecStatus(
  schema: Schema,
  approvals: ApprovalsFile,
  artifactFiles: Record<string, boolean>,
): ArtifactStatus[] {
  return schema.artifacts.map((artifact) => {
    const approval = approvals.artifacts[artifact.id];
    const fileExists = artifactFiles[artifact.id] || false;
    const isApproved = approval?.state === 'approved';

    // Check if all required predecessors are approved
    const allRequiredApproved = artifact.requires.every((req) => {
      const reqApproval = approvals.artifacts[req];
      return reqApproval?.state === 'approved';
    });

    let state: ArtifactStatusState;
    if (!allRequiredApproved && artifact.requires.length > 0) {
      state = 'blocked';
    } else if (!fileExists) {
      state = 'ready';
    } else if (!isApproved) {
      state = 'in_review';
    } else {
      state = 'done';
    }

    return {
      id: artifact.id,
      state,
      description: artifact.description,
      requires: artifact.requires,
      fileExists,
      approved: isApproved,
      approvedAt: approval?.approvedAt,
      approvedBy: approval?.approvedBy,
    };
  });
}

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface DevflowConfig {
  specsDir?: string;
}

function loadConfig(): DevflowConfig {
  const configPath = path.join(process.cwd(), "devflow.yaml");
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      return (yaml.load(content) as DevflowConfig) || {};
    } catch {
      return {};
    }
  }
  return {};
}

export function getSpecsDir(): string {
  const config = loadConfig();
  if (config.specsDir) {
    return path.resolve(process.cwd(), config.specsDir);
  }
  return path.join(process.cwd(), "devflow", "specs");
}

export function getSpecDir(specName: string): string {
  return path.join(getSpecsDir(), specName);
}

export function getApprovalsPath(specName: string): string {
  return path.join(getSpecDir(specName), ".approvals.json");
}

export function getMetaPath(specName: string): string {
  return path.join(getSpecDir(specName), ".meta.json");
}

export function getArtifactPath(specName: string, artifactType: string): string {
  return path.join(getSpecDir(specName), `${artifactType}.md`);
}

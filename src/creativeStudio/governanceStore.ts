import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { FinalArtQaResult } from "../finalArtQa/types.js";

export interface FinalVisualQaRecord {
  schemaVersion: 1;
  designId: string;
  designVersion: number;
  checkedAt: string;
  deterministicDecision: "PASS" | "WARN";
  renderedPngPath: string;
  result: FinalArtQaResult;
}

export interface DesignApprovalRecord {
  schemaVersion: 1;
  designId: string;
  designVersion: number;
  approvedAt: string;
  approvedBy: string;
  deterministicDecision: "PASS" | "WARN";
  finalVisualQaDecision: "PASS";
  note?: string;
}

export interface ApprovedExportRecord {
  schemaVersion: 1;
  designId: string;
  designVersion: number;
  approvedAt: string;
  exportedAt: string;
  format: "png";
  preset: "standard" | "high-resolution" | "4k";
  path: string;
  width: number;
  height: number;
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function version(value: number): number {
  if (!Number.isInteger(value) || value < 1) throw new Error("Design version must be a positive integer.");
  return value;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export class CreativeStudioGovernanceStore {
  readonly rootDir: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
  }

  private dir(designId: string): string {
    return join(this.rootDir, "designs", safeId(designId, "designId"), "governance");
  }

  private async ensure(designId: string): Promise<void> {
    await mkdir(this.dir(designId), { recursive: true });
  }

  private finalVisualQaPath(designId: string, designVersion: number): string {
    return join(this.dir(designId), `final-visual-qa-v${version(designVersion)}.json`);
  }

  private approvalPath(designId: string, designVersion: number): string {
    return join(this.dir(designId), `approval-v${version(designVersion)}.json`);
  }

  async saveFinalVisualQa(record: FinalVisualQaRecord): Promise<void> {
    if (record.result.decision === "PASS" || record.result.decision === "REGENERATE" || record.result.decision === "HUMAN_REVIEW" || record.result.decision === "BLOCK") {
      await this.ensure(record.designId);
      await writeJson(this.finalVisualQaPath(record.designId, record.designVersion), record);
      return;
    }
    throw new Error("Invalid final visual QA decision.");
  }

  async getFinalVisualQa(designId: string, designVersion: number): Promise<FinalVisualQaRecord | undefined> {
    const value = await readJson<FinalVisualQaRecord | null>(this.finalVisualQaPath(designId, designVersion), null);
    return value ?? undefined;
  }

  async saveApproval(record: DesignApprovalRecord): Promise<void> {
    if (record.finalVisualQaDecision !== "PASS") throw new Error("Only a PASS final visual QA can be approved.");
    await this.ensure(record.designId);
    await writeJson(this.approvalPath(record.designId, record.designVersion), record);
  }

  async getApproval(designId: string, designVersion: number): Promise<DesignApprovalRecord | undefined> {
    const value = await readJson<DesignApprovalRecord | null>(this.approvalPath(designId, designVersion), null);
    return value ?? undefined;
  }

  async appendApprovedExport(record: ApprovedExportRecord): Promise<void> {
    await this.ensure(record.designId);
    const path = join(this.dir(record.designId), "approved-exports.json");
    const records = await readJson<ApprovedExportRecord[]>(path, []);
    records.push(record);
    await writeJson(path, records);
  }

  async listApprovedExports(designId: string): Promise<ApprovedExportRecord[]> {
    return readJson<ApprovedExportRecord[]>(join(this.dir(designId), "approved-exports.json"), []);
  }
}

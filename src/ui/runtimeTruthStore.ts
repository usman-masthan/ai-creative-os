import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { TaskTruthSnapshot } from "../taskTruth.js";
import type { TruthRecord, TruthScope } from "../types.js";

interface BranchMasterFile {
  sourceId: string;
  status: "VERIFIED";
  branches: Array<{
    branchId: string;
    brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
    canonicalPhysicalAddress: string;
    officialPhone: string;
    physicalOpeningHours: { daily: string };
  }>;
}

function scopeKey(scope: TruthScope): string {
  return [
    scope.tenantId,
    scope.brandId ?? "",
    scope.branchId ?? "",
    scope.productId ?? "",
    scope.salesChannel ?? "",
  ].join("|");
}

function truthIdentity(record: Pick<TruthRecord, "key" | "scope">): string {
  return `${record.key}|${scopeKey(record.scope)}`;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

export class RuntimeTruthStore {
  readonly rootDir: string;
  readonly path: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.path = join(this.rootDir, "truth", "runtime.json");
  }

  async list(): Promise<TruthRecord[]> {
    return readJson<TruthRecord[]>(this.path, []);
  }

  async writeBackRequested(snapshot: TaskTruthSnapshot): Promise<TruthRecord[]> {
    const requested = snapshot.facts.filter((fact) => fact.updateStoredTruthRequested);
    if (!requested.length) return [];

    const existing = await this.list();
    const map = new Map(existing.map((record) => [truthIdentity(record), record]));
    const written: TruthRecord[] = [];

    for (const fact of requested) {
      const record: TruthRecord = {
        key: fact.key,
        value: fact.value,
        status: "OWNER_SOURCE_CONFIRMED",
        sourceId: `TASK_WRITEBACK:${snapshot.sessionId}`,
        scope: fact.scope,
        observedAt: snapshot.confirmedAt,
        timeSensitive: true,
      };
      map.set(truthIdentity(record), record);
      written.push(record);
    }

    await mkdir(join(this.rootDir, "truth"), { recursive: true });
    await writeFile(this.path, `${JSON.stringify([...map.values()], null, 2)}\n`, "utf8");
    return written;
  }
}

export async function loadStaticAtthasTruth(repoRoot = process.cwd()): Promise<TruthRecord[]> {
  const path = join(resolve(repoRoot), "clients/T001-atthas/truth/branch-master.json");
  const master = JSON.parse(await readFile(path, "utf8")) as BranchMasterFile;
  const records: TruthRecord[] = [];

  for (const branch of master.branches) {
    const scope = {
      tenantId: "T001" as const,
      brandId: branch.brandId,
      branchId: branch.branchId,
    };
    records.push(
      {
        key: "branchPhysicalAddress",
        value: branch.canonicalPhysicalAddress,
        status: master.status,
        sourceId: master.sourceId,
        scope,
      },
      {
        key: "branchPhone",
        value: branch.officialPhone,
        status: master.status,
        sourceId: master.sourceId,
        scope,
      },
      {
        key: "physicalOpeningHours",
        value: branch.physicalOpeningHours.daily,
        status: master.status,
        sourceId: master.sourceId,
        scope,
      },
    );
  }
  return records;
}

/**
 * Runtime confirmations are a governed overlay. When a user explicitly asked
 * to write back a corrected task value, that exact key/scope replaces the
 * older static value for future questionnaires. It still must be confirmed
 * again before every new customer-facing task.
 */
export function mergeTruthLayers(staticRecords: TruthRecord[], runtimeRecords: TruthRecord[]): TruthRecord[] {
  const runtimeKeys = new Set(runtimeRecords.map(truthIdentity));
  return [
    ...runtimeRecords,
    ...staticRecords.filter((record) => !runtimeKeys.has(truthIdentity(record))),
  ];
}

export async function loadAtthasStoredTruth(input: {
  repoRoot?: string;
  runtimeStore: RuntimeTruthStore;
}): Promise<{ records: TruthRecord[]; staticRecords: TruthRecord[]; runtimeRecords: TruthRecord[] }> {
  const [staticRecords, runtimeRecords] = await Promise.all([
    loadStaticAtthasTruth(input.repoRoot),
    input.runtimeStore.list(),
  ]);
  return {
    staticRecords,
    runtimeRecords,
    records: mergeTruthLayers(staticRecords, runtimeRecords),
  };
}

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import type { DesignDocument, DesignGroupLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import type {
  CreativeComponentMigrationDesignPlan,
  CreativeComponentMigrationExecutionRecord,
  CreativeComponentMigrationPlan,
} from "./componentMigration.js";
import { runDesignQa, type DesignQaResult } from "./designQa.js";
import { CreativeStudioGovernanceStore } from "./governanceStore.js";
import { FileDesignProjectStore } from "./projectStore.js";
import { DesignVersionService, type DesignVersionComparison } from "./versioning.js";

export type CreativeComponentMigrationOperationalStatus =
  | "PENDING"
  | "RECORDED_EXECUTION"
  | "PERSISTED_WITHOUT_EXECUTION_AUDIT"
  | "STALE_CHANGED"
  | "DESIGN_MISSING"
  | "AUDIT_INCONSISTENT";

export interface CreativeComponentMigrationOperationalItem {
  planId: string;
  itemId: string;
  designId: string;
  campaignId: string;
  sourceDesignVersion: number;
  targetDesignVersion: number;
  targetComponentId: string;
  instanceIds: string[];
  status: CreativeComponentMigrationOperationalStatus;
  executionIds: string[];
  currentDesignVersion?: number;
  migrationVersionPresent: boolean;
  reason: string;
}

export interface CreativeComponentMigrationOperationalPlan {
  plan: CreativeComponentMigrationPlan;
  items: CreativeComponentMigrationOperationalItem[];
  executions: CreativeComponentMigrationExecutionRecord[];
  totals: {
    pending: number;
    recorded: number;
    persistedWithoutAudit: number;
    staleChanged: number;
    missingOrInconsistent: number;
  };
}

export interface CreativeComponentMigrationRecoveryPreview {
  schemaVersion: 1;
  planId: string;
  itemId: string;
  designId: string;
  currentDesignVersion: number;
  migrationTargetVersion: number;
  restoreSourceVersion: number;
  proposedRecoveryVersion: number;
  currentVersionApproved: boolean;
  requiresApprovedRevisionAcknowledgement: boolean;
  operationalStatus: CreativeComponentMigrationOperationalStatus;
  comparison: DesignVersionComparison;
  qa: DesignQaResult;
  restorable: boolean;
  blockers: string[];
  previewToken: string;
  generatedAt: string;
}

export interface CreativeComponentMigrationRecoveryRecord {
  schemaVersion: 1;
  recoveryId: string;
  planId: string;
  itemId: string;
  designId: string;
  fromCurrentVersion: number;
  restoredContentFromVersion: number;
  recoveryVersion: number;
  currentVersionWasApproved: boolean;
  approvedRevisionAcknowledged: boolean;
  qaDecision: "PASS" | "WARN";
  previewToken: string;
  createdAt: string;
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function validDate(value: string, name: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO date-time.`);
  return value;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function listJson<T>(directory: string): Promise<T[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const output: T[] = [];
  for (const name of names.filter((entry) => entry.endsWith(".json")).sort()) {
    const value = await readJson<T>(join(directory, name));
    if (value !== undefined) output.push(value);
  }
  return output;
}

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot> {
  const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
  const snapshot = truthSnapshotFromTrace(trace.truth);
  if (!snapshot) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: migration recovery requires confirmed destination truth.");
  return snapshot;
}

function rootForInstance(document: DesignDocument, instanceId: string): DesignGroupLayer | undefined {
  return document.layers.find(
    (layer): layer is DesignGroupLayer => layer.type === "group"
      && layer.componentInstance?.templateLayerId === "group-root"
      && layer.componentInstance.instanceId === instanceId,
  );
}

function migrationEvidence(
  document: DesignDocument,
  item: CreativeComponentMigrationDesignPlan,
  targetComponentId: string,
): boolean {
  if (document.version !== item.targetDesignVersion) return false;
  const historyEntry = document.history.find((entry) => entry.version === item.targetDesignVersion);
  if (!historyEntry || !historyEntry.summary.startsWith("Migrated reusable component instances ")) return false;
  return item.instances.every((instance) => {
    const root = rootForInstance(document, instance.instanceId);
    return root?.componentInstance?.componentId === targetComponentId;
  });
}

function candidateRecoveryDocument(input: {
  current: DesignDocument;
  source: DesignDocument;
  planId: string;
  itemId: string;
  timestamp: string;
}): DesignDocument {
  const nextVersion = input.current.version + 1;
  return assertDesignDocument({
    ...input.source,
    id: input.current.id,
    campaignId: input.current.campaignId,
    truthSnapshotId: input.current.truthSnapshotId,
    version: nextVersion,
    history: [
      ...input.current.history,
      {
        version: nextVersion,
        createdAt: input.timestamp,
        actor: "human",
        summary: `Recovered pre-migration content from v${input.source.version} for ${input.planId}/${input.itemId}.`,
      },
    ],
    createdAt: input.current.createdAt,
    updatedAt: input.timestamp,
  });
}

export class FileCreativeComponentMigrationOperations {
  readonly rootDir: string;
  readonly projects: FileDesignProjectStore;
  readonly versions: DesignVersionService;
  readonly governance: CreativeStudioGovernanceStore;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.projects = new FileDesignProjectStore(rootDir);
    this.versions = new DesignVersionService(rootDir);
    this.governance = new CreativeStudioGovernanceStore(rootDir);
  }

  private base(clientId: string, brandId: string): string {
    return join(
      this.rootDir,
      "components",
      safeId(clientId, "clientId"),
      safeId(brandId, "brandId"),
      "_migrations",
    );
  }

  private recoveryPath(clientId: string, brandId: string, recoveryId: string): string {
    return join(this.base(clientId, brandId), "recoveries", `${safeId(recoveryId, "recoveryId")}.json`);
  }

  async listHistory(input: {
    clientId: string;
    brandId: string;
    familyId?: string;
  }): Promise<{
    plans: CreativeComponentMigrationOperationalPlan[];
    recoveries: CreativeComponentMigrationRecoveryRecord[];
  }> {
    const base = this.base(input.clientId, input.brandId);
    const [plans, executions, recoveries] = await Promise.all([
      listJson<CreativeComponentMigrationPlan>(join(base, "plans")),
      listJson<CreativeComponentMigrationExecutionRecord>(join(base, "executions")),
      listJson<CreativeComponentMigrationRecoveryRecord>(join(base, "recoveries")),
    ]);
    const selectedPlans = input.familyId
      ? plans.filter((plan) => plan.familyId === safeId(input.familyId!, "familyId"))
      : plans;
    const operational: CreativeComponentMigrationOperationalPlan[] = [];
    for (const plan of selectedPlans.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const planExecutions = executions.filter((record) => record.planId === plan.planId);
      const items: CreativeComponentMigrationOperationalItem[] = [];
      for (const item of plan.eligibleDesigns) {
        const itemExecutions = planExecutions.filter((record) => record.executedDesigns.some((entry) => entry.itemId === item.itemId));
        const state = await this.projects.getState(item.designId);
        let migrationVersion: DesignDocument | undefined;
        try {
          migrationVersion = await this.versions.readVersion(item.designId, item.targetDesignVersion);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith("DESIGN_VERSION_NOT_FOUND:")) throw error;
        }
        const hasEvidence = migrationVersion ? migrationEvidence(migrationVersion, item, plan.targetComponentId) : false;
        let status: CreativeComponentMigrationOperationalStatus;
        let reason: string;
        if (!state) {
          status = "DESIGN_MISSING";
          reason = "The DesignProject referenced by this migration item is no longer available.";
        } else if (itemExecutions.length && !hasEvidence) {
          status = "AUDIT_INCONSISTENT";
          reason = "An immutable execution audit exists, but the expected migration version/evidence is missing.";
        } else if (itemExecutions.length) {
          status = "RECORDED_EXECUTION";
          reason = "Migration persistence and immutable execution audit are both present.";
        } else if (hasEvidence) {
          status = "PERSISTED_WITHOUT_EXECUTION_AUDIT";
          reason = "The migration design revision exists but no execution audit references this item; this indicates an interrupted file-backed batch after design persistence.";
        } else if (state.currentVersion === item.sourceDesignVersion) {
          status = "PENDING";
          reason = "The design remains at the dry-run source version and has not been migrated by this plan.";
        } else {
          status = "STALE_CHANGED";
          reason = `The design is currently v${state.currentVersion}, not the planned source v${item.sourceDesignVersion}; create a fresh dry-run before migration.`;
        }
        items.push({
          planId: plan.planId,
          itemId: item.itemId,
          designId: item.designId,
          campaignId: item.campaignId,
          sourceDesignVersion: item.sourceDesignVersion,
          targetDesignVersion: item.targetDesignVersion,
          targetComponentId: plan.targetComponentId,
          instanceIds: item.instances.map((entry) => entry.instanceId),
          status,
          executionIds: itemExecutions.map((record) => record.executionId),
          ...(state ? { currentDesignVersion: state.currentVersion } : {}),
          migrationVersionPresent: Boolean(migrationVersion),
          reason,
        });
      }
      operational.push({
        plan,
        items,
        executions: planExecutions,
        totals: {
          pending: items.filter((item) => item.status === "PENDING").length,
          recorded: items.filter((item) => item.status === "RECORDED_EXECUTION").length,
          persistedWithoutAudit: items.filter((item) => item.status === "PERSISTED_WITHOUT_EXECUTION_AUDIT").length,
          staleChanged: items.filter((item) => item.status === "STALE_CHANGED").length,
          missingOrInconsistent: items.filter((item) => item.status === "DESIGN_MISSING" || item.status === "AUDIT_INCONSISTENT").length,
        },
      });
    }
    return {
      plans: operational,
      recoveries: recoveries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  private async resolveRecoveryItem(input: {
    clientId: string;
    brandId: string;
    planId: string;
    itemId: string;
  }): Promise<{
    operational: CreativeComponentMigrationOperationalItem;
    plan: CreativeComponentMigrationPlan;
    item: CreativeComponentMigrationDesignPlan;
  }> {
    const history = await this.listHistory({ clientId: input.clientId, brandId: input.brandId });
    const planState = history.plans.find((entry) => entry.plan.planId === safeId(input.planId, "planId"));
    if (!planState) throw new Error(`COMPONENT_MIGRATION_PLAN_NOT_FOUND: ${input.planId}`);
    const item = planState.plan.eligibleDesigns.find((entry) => entry.itemId === safeId(input.itemId, "itemId"));
    if (!item) throw new Error(`COMPONENT_MIGRATION_ITEM_NOT_FOUND: ${input.itemId}`);
    const operational = planState.items.find((entry) => entry.itemId === item.itemId);
    if (!operational) throw new Error(`COMPONENT_MIGRATION_OPERATIONAL_ITEM_MISSING: ${item.itemId}`);
    if (operational.status !== "RECORDED_EXECUTION" && operational.status !== "PERSISTED_WITHOUT_EXECUTION_AUDIT") {
      throw new Error(`COMPONENT_MIGRATION_RECOVERY_NOT_APPLICABLE: ${operational.status}.`);
    }
    return { operational, plan: planState.plan, item };
  }

  async previewRecovery(input: {
    clientId: string;
    brandId: string;
    planId: string;
    itemId: string;
    generatedAt?: string;
  }): Promise<CreativeComponentMigrationRecoveryPreview> {
    const { operational, item } = await this.resolveRecoveryItem(input);
    const project = await this.projects.get(item.designId);
    if (!project) throw new Error(`COMPONENT_MIGRATION_DESIGN_MISSING: ${item.designId}`);
    const [source, approval, truth] = await Promise.all([
      this.versions.readVersion(item.designId, item.sourceDesignVersion),
      this.governance.getApproval(project.document.id, project.document.version),
      campaignTruth(this.rootDir, project.document.campaignId),
    ]);
    const generatedAt = validDate(input.generatedAt ?? new Date().toISOString(), "migration recovery generatedAt");
    const candidate = candidateRecoveryDocument({
      current: project.document,
      source,
      planId: input.planId,
      itemId: item.itemId,
      timestamp: generatedAt,
    });
    const qa = runDesignQa({ document: candidate, truthSnapshot: truth, checkedAt: generatedAt });
    const comparison = await this.versions.compare(item.designId, item.sourceDesignVersion, item.targetDesignVersion);
    const blockers: string[] = [];
    if (qa.decision === "BLOCK") blockers.push("Recovered pre-migration content fails current deterministic QA.");
    const unsigned = {
      schemaVersion: 1 as const,
      planId: safeId(input.planId, "planId"),
      itemId: item.itemId,
      designId: item.designId,
      currentDesignVersion: project.document.version,
      migrationTargetVersion: item.targetDesignVersion,
      restoreSourceVersion: item.sourceDesignVersion,
      proposedRecoveryVersion: project.document.version + 1,
      currentVersionApproved: Boolean(approval),
      requiresApprovedRevisionAcknowledgement: Boolean(approval),
      operationalStatus: operational.status,
      comparison,
      qa,
      restorable: blockers.length === 0,
      blockers,
    };
    const tokenPayload = {
      ...unsigned,
      qa: { decision: qa.decision, issues: qa.issues, scores: qa.scores },
      candidate: {
        version: candidate.version,
        artboard: candidate.artboard,
        brand: candidate.brand,
        layoutId: candidate.layoutId,
        layers: candidate.layers,
        truthSnapshotId: candidate.truthSnapshotId,
      },
    };
    return {
      ...unsigned,
      previewToken: hash(tokenPayload),
      generatedAt,
    };
  }

  async restorePreMigration(input: {
    clientId: string;
    brandId: string;
    planId: string;
    itemId: string;
    expectedPreviewToken: string;
    acknowledgeApprovedCurrent: boolean;
    createdAt?: string;
  }): Promise<{
    record: CreativeComponentMigrationRecoveryRecord;
    document: DesignDocument;
    qa: DesignQaResult;
  }> {
    const preview = await this.previewRecovery({
      clientId: input.clientId,
      brandId: input.brandId,
      planId: input.planId,
      itemId: input.itemId,
      ...(input.createdAt ? { generatedAt: input.createdAt } : {}),
    });
    if (preview.previewToken !== input.expectedPreviewToken.trim()) {
      throw new Error("COMPONENT_MIGRATION_RECOVERY_STALE_PREVIEW: current design or recovery state changed after preview.");
    }
    if (!preview.restorable) {
      throw new Error(`COMPONENT_MIGRATION_RECOVERY_QA_BLOCK: ${preview.blockers.join(" ")}`);
    }
    if (preview.currentVersionApproved && !input.acknowledgeApprovedCurrent) {
      throw new Error("COMPONENT_MIGRATION_RECOVERY_APPROVED_ACK_REQUIRED: current exact version is approved; recovery must be an explicitly acknowledged new revision.");
    }
    const { item } = await this.resolveRecoveryItem(input);
    const [project, source, truth] = await Promise.all([
      this.projects.get(item.designId),
      this.versions.readVersion(item.designId, item.sourceDesignVersion),
      campaignTruth(this.rootDir, item.campaignId),
    ]);
    if (!project) throw new Error(`COMPONENT_MIGRATION_DESIGN_MISSING: ${item.designId}`);
    if (project.document.version !== preview.currentDesignVersion) {
      throw new Error("COMPONENT_MIGRATION_RECOVERY_DESIGN_STALE: current design version changed after preview.");
    }
    const createdAt = validDate(input.createdAt ?? new Date().toISOString(), "migration recovery createdAt");
    const recovered = candidateRecoveryDocument({
      current: project.document,
      source,
      planId: input.planId,
      itemId: item.itemId,
      timestamp: createdAt,
    });
    const qa = runDesignQa({ document: recovered, truthSnapshot: truth, checkedAt: createdAt });
    if (qa.decision === "BLOCK") throw new Error("COMPONENT_MIGRATION_RECOVERY_QA_BLOCK: deterministic QA changed to BLOCK before save.");
    const saved = await this.projects.save(recovered);
    await this.projects.saveQa(recovered.id, {
      checkedAt: qa.checkedAt,
      decision: qa.decision,
      issues: qa.issues,
    });
    const recoveryId = safeId(
      `migration-recovery-${input.planId}-${item.itemId}-v${recovered.version}`,
      "recoveryId",
    );
    const record: CreativeComponentMigrationRecoveryRecord = {
      schemaVersion: 1,
      recoveryId,
      planId: safeId(input.planId, "planId"),
      itemId: item.itemId,
      designId: item.designId,
      fromCurrentVersion: preview.currentDesignVersion,
      restoredContentFromVersion: item.sourceDesignVersion,
      recoveryVersion: recovered.version,
      currentVersionWasApproved: preview.currentVersionApproved,
      approvedRevisionAcknowledged: input.acknowledgeApprovedCurrent,
      qaDecision: qa.decision,
      previewToken: preview.previewToken,
      createdAt,
    };
    const path = this.recoveryPath(input.clientId, input.brandId, recoveryId);
    const existing = await readJson<CreativeComponentMigrationRecoveryRecord>(path);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(record)) {
        throw new Error("COMPONENT_MIGRATION_RECOVERY_IMMUTABLE: recovery id already exists with different content.");
      }
    } else {
      await mkdir(join(this.base(input.clientId, input.brandId), "recoveries"), { recursive: true });
      await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    }
    return { record, document: saved.document, qa };
  }
}

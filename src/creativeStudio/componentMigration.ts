import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import type { DesignDocument, DesignGroupLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import type { CreativeReusableComponent } from "./componentLibrary.js";
import {
  FileCreativeComponentImpactAnalyzer,
  type CreativeComponentImpactReport,
  type CreativeComponentInstanceImpact,
} from "./componentImpact.js";
import {
  FileCreativeComponentLifecycleStore,
  replaceReusableComponentInstance,
  type CreativeComponentFamilyRecord,
} from "./componentLifecycle.js";
import { runDesignQa } from "./designQa.js";
import { CreativeStudioGovernanceStore } from "./governanceStore.js";
import { FileDesignProjectStore } from "./projectStore.js";

export interface CreativeComponentMigrationInstancePlan {
  instanceId: string;
  groupLayerId: string;
  currentComponentId: string;
  currentVersion: number;
  targetComponentId: string;
  targetVersion: number;
}

export interface CreativeComponentMigrationDesignPlan {
  itemId: string;
  designId: string;
  campaignId: string;
  sourceDesignVersion: number;
  targetDesignVersion: number;
  instances: CreativeComponentMigrationInstancePlan[];
  preconditionToken: string;
}

export interface CreativeComponentMigrationExclusion {
  designId: string;
  designVersion: number;
  campaignId: string;
  instanceId: string;
  currentComponentId: string;
  currentVersion: number;
  governance: CreativeComponentInstanceImpact["governance"];
  upgradeReadiness: CreativeComponentInstanceImpact["upgradeReadiness"];
  reason: string;
}

export interface CreativeComponentMigrationPlan {
  schemaVersion: 1;
  planId: string;
  clientId: string;
  brandId: string;
  familyId: string;
  familyStatus: CreativeComponentFamilyRecord["status"];
  targetComponentId: string;
  targetVersion: number;
  createdAt: string;
  sourceImpactToken: string;
  eligibleDesigns: CreativeComponentMigrationDesignPlan[];
  exclusions: CreativeComponentMigrationExclusion[];
  totals: {
    eligibleDesigns: number;
    eligibleInstances: number;
    excludedInstances: number;
    frozenApproved: number;
    blocked: number;
  };
  planToken: string;
}

export interface CreativeComponentMigrationExecutionDesign {
  designId: string;
  fromVersion: number;
  toVersion: number;
  itemId: string;
  instanceIds: string[];
  qaDecision: "PASS" | "WARN" | "BLOCK";
}

export interface CreativeComponentMigrationExecutionRecord {
  schemaVersion: 1;
  executionId: string;
  planId: string;
  familyId: string;
  targetComponentId: string;
  targetVersion: number;
  requestedItemIds: string[];
  executedDesigns: CreativeComponentMigrationExecutionDesign[];
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

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot> {
  const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
  const snapshot = truthSnapshotFromTrace(trace.truth);
  if (!snapshot) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: component migration requires confirmed destination truth.");
  return snapshot;
}

function rootInstance(document: DesignDocument, instanceId: string): DesignGroupLayer {
  const group = document.layers.find(
    (layer): layer is DesignGroupLayer => layer.type === "group"
      && layer.componentInstance?.templateLayerId === "group-root"
      && layer.componentInstance.instanceId === instanceId,
  );
  if (!group) throw new Error(`COMPONENT_MIGRATION_INSTANCE_MISSING: ${instanceId}`);
  return group;
}

function designPrecondition(input: {
  familyId: string;
  targetComponent: CreativeReusableComponent;
  designId: string;
  designVersion: number;
  campaignId: string;
  truthSnapshotId: string;
  approved: boolean;
  instances: CreativeComponentMigrationInstancePlan[];
}): string {
  return hash({
    familyId: input.familyId,
    target: {
      id: input.targetComponent.id,
      templates: input.targetComponent.templates,
      requiredTruthKeys: input.targetComponent.requiredTruthKeys,
    },
    designId: input.designId,
    designVersion: input.designVersion,
    campaignId: input.campaignId,
    truthSnapshotId: input.truthSnapshotId,
    approved: input.approved,
    instances: input.instances,
  });
}

function planToken(input: Omit<CreativeComponentMigrationPlan, "createdAt" | "planToken">): string {
  return hash(input);
}

function collapseMigrationRevision(input: {
  source: DesignDocument;
  migrated: DesignDocument;
  instanceIds: string[];
  targetComponentId: string;
  timestamp: string;
}): DesignDocument {
  const version = input.source.version + 1;
  return assertDesignDocument({
    ...input.migrated,
    version,
    history: [
      ...input.source.history,
      {
        version,
        createdAt: input.timestamp,
        summary: `Migrated reusable component instances ${input.instanceIds.join(", ")} to ${input.targetComponentId}.`,
        actor: "human",
      },
    ],
    updatedAt: input.timestamp,
  });
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export class FileCreativeComponentMigrationStore {
  readonly rootDir: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
  }

  private base(clientId: string, brandId: string): string {
    return join(this.rootDir, "components", safeId(clientId, "clientId"), safeId(brandId, "brandId"), "_migrations");
  }

  private planPath(clientId: string, brandId: string, planId: string): string {
    return join(this.base(clientId, brandId), "plans", `${safeId(planId, "planId")}.json`);
  }

  private executionPath(clientId: string, brandId: string, executionId: string): string {
    return join(this.base(clientId, brandId), "executions", `${safeId(executionId, "executionId")}.json`);
  }

  async savePlan(plan: CreativeComponentMigrationPlan): Promise<CreativeComponentMigrationPlan> {
    const path = this.planPath(plan.clientId, plan.brandId, plan.planId);
    const existing = await readJson<CreativeComponentMigrationPlan>(path);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(plan)) throw new Error("COMPONENT_MIGRATION_PLAN_IMMUTABLE: plan id already exists with different content.");
      return existing;
    }
    await mkdir(join(this.base(plan.clientId, plan.brandId), "plans"), { recursive: true });
    await writeFile(path, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    return plan;
  }

  async getPlan(clientId: string, brandId: string, planId: string): Promise<CreativeComponentMigrationPlan | undefined> {
    return readJson<CreativeComponentMigrationPlan>(this.planPath(clientId, brandId, planId));
  }

  async saveExecution(input: {
    clientId: string;
    brandId: string;
    record: CreativeComponentMigrationExecutionRecord;
  }): Promise<CreativeComponentMigrationExecutionRecord> {
    const path = this.executionPath(input.clientId, input.brandId, input.record.executionId);
    const existing = await readJson<CreativeComponentMigrationExecutionRecord>(path);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(input.record)) throw new Error("COMPONENT_MIGRATION_EXECUTION_IMMUTABLE: execution id collision.");
      return existing;
    }
    await mkdir(join(this.base(input.clientId, input.brandId), "executions"), { recursive: true });
    await writeFile(path, `${JSON.stringify(input.record, null, 2)}\n`, "utf8");
    return input.record;
  }
}

export class FileCreativeComponentMigrationPlanner {
  readonly rootDir: string;
  readonly impact: FileCreativeComponentImpactAnalyzer;
  readonly lifecycle: FileCreativeComponentLifecycleStore;
  readonly projects: FileDesignProjectStore;
  readonly governance: CreativeStudioGovernanceStore;
  readonly store: FileCreativeComponentMigrationStore;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.impact = new FileCreativeComponentImpactAnalyzer(rootDir);
    this.lifecycle = new FileCreativeComponentLifecycleStore(rootDir);
    this.projects = new FileDesignProjectStore(rootDir);
    this.governance = new CreativeStudioGovernanceStore(rootDir);
    this.store = new FileCreativeComponentMigrationStore(rootDir);
  }

  async createPlan(input: {
    family: CreativeComponentFamilyRecord;
    targetComponent: CreativeReusableComponent;
    targetVersion: number;
    createdAt?: string;
  }): Promise<CreativeComponentMigrationPlan> {
    if (input.family.status !== "ACTIVE") throw new Error(`COMPONENT_MIGRATION_FAMILY_NOT_ACTIVE: ${input.family.familyId} is ${input.family.status}.`);
    const report = await this.impact.analyze({
      family: input.family,
      targetComponent: input.targetComponent,
      targetVersion: input.targetVersion,
      ...(input.createdAt ? { generatedAt: input.createdAt } : {}),
    });
    const eligibleDesigns: CreativeComponentMigrationDesignPlan[] = [];
    const exclusions: CreativeComponentMigrationExclusion[] = [];

    for (const design of report.designs) {
      const eligible = design.instances.filter(
        (entry) => entry.governance === "EDITABLE" && entry.upgradeReadiness === "UPGRADEABLE",
      );
      for (const entry of design.instances.filter((candidate) => !eligible.includes(candidate))) {
        exclusions.push({
          designId: entry.designId,
          designVersion: entry.designVersion,
          campaignId: entry.campaignId,
          instanceId: entry.instanceId,
          currentComponentId: entry.currentComponentId,
          currentVersion: entry.currentVersion,
          governance: entry.governance,
          upgradeReadiness: entry.upgradeReadiness,
          reason: entry.reason,
        });
      }
      if (!eligible.length) continue;
      const project = await this.projects.get(design.designId);
      if (!project) throw new Error(`COMPONENT_MIGRATION_DESIGN_MISSING: ${design.designId}`);
      const instances: CreativeComponentMigrationInstancePlan[] = eligible.map((entry) => ({
        instanceId: entry.instanceId,
        groupLayerId: entry.groupLayerId,
        currentComponentId: entry.currentComponentId,
        currentVersion: entry.currentVersion,
        targetComponentId: entry.targetComponentId,
        targetVersion: entry.targetVersion,
      }));
      const itemId = safeId(`design-${design.designId}-v${design.designVersion}`, "migration itemId");
      eligibleDesigns.push({
        itemId,
        designId: design.designId,
        campaignId: design.campaignId,
        sourceDesignVersion: design.designVersion,
        targetDesignVersion: design.designVersion + 1,
        instances,
        preconditionToken: designPrecondition({
          familyId: input.family.familyId,
          targetComponent: input.targetComponent,
          designId: design.designId,
          designVersion: design.designVersion,
          campaignId: design.campaignId,
          truthSnapshotId: project.document.truthSnapshotId,
          approved: design.approvedCurrentVersion,
          instances,
        }),
      });
    }

    eligibleDesigns.sort((a, b) => a.designId.localeCompare(b.designId));
    exclusions.sort((a, b) => `${a.designId}:${a.instanceId}`.localeCompare(`${b.designId}:${b.instanceId}`));
    const unsigned: Omit<CreativeComponentMigrationPlan, "createdAt" | "planToken"> = {
      schemaVersion: 1,
      planId: safeId(`migration-${input.family.familyId}-v${input.targetVersion}-${report.impactToken.slice(0, 12)}`, "planId"),
      clientId: input.family.clientId,
      brandId: input.family.brandId,
      familyId: input.family.familyId,
      familyStatus: input.family.status,
      targetComponentId: input.targetComponent.id,
      targetVersion: input.targetVersion,
      sourceImpactToken: report.impactToken,
      eligibleDesigns,
      exclusions,
      totals: {
        eligibleDesigns: eligibleDesigns.length,
        eligibleInstances: eligibleDesigns.reduce((sum, item) => sum + item.instances.length, 0),
        excludedInstances: exclusions.length,
        frozenApproved: exclusions.filter((entry) => entry.governance === "FROZEN_APPROVED").length,
        blocked: exclusions.filter((entry) => entry.upgradeReadiness.startsWith("BLOCKED_")).length,
      },
    };
    const createdAt = validDate(input.createdAt ?? new Date().toISOString(), "component migration createdAt");
    const plan: CreativeComponentMigrationPlan = {
      ...unsigned,
      createdAt,
      planToken: planToken(unsigned),
    };
    return this.store.savePlan(plan);
  }

  async execute(input: {
    plan: CreativeComponentMigrationPlan;
    selectedItemIds: string[];
    createdAt?: string;
  }): Promise<CreativeComponentMigrationExecutionRecord> {
    if (!input.selectedItemIds.length) throw new Error("COMPONENT_MIGRATION_SELECTION_REQUIRED: choose at least one design migration item.");
    const uniqueIds = [...new Set(input.selectedItemIds.map((id) => safeId(id, "selectedItemId")))].sort();
    const selected = uniqueIds.map((id) => {
      const item = input.plan.eligibleDesigns.find((candidate) => candidate.itemId === id);
      if (!item) throw new Error(`COMPONENT_MIGRATION_ITEM_NOT_ELIGIBLE: ${id}`);
      return item;
    });
    const family = await this.lifecycle.get(input.plan.clientId, input.plan.brandId, input.plan.familyId);
    if (!family || family.status !== "ACTIVE") throw new Error("COMPONENT_MIGRATION_FAMILY_NOT_ACTIVE: migration execution requires the family to remain ACTIVE.");
    const targetRef = family.versions.find((entry) => entry.componentId === input.plan.targetComponentId);
    if (!targetRef || targetRef.version !== input.plan.targetVersion) throw new Error("COMPONENT_MIGRATION_TARGET_STALE: target is no longer a valid family version.");
    const targetComponent = await this.lifecycle.components.get(input.plan.clientId, input.plan.brandId, input.plan.targetComponentId);
    if (!targetComponent) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${input.plan.targetComponentId}`);
    const timestamp = validDate(input.createdAt ?? new Date().toISOString(), "component migration execution createdAt");

    const prepared: Array<{
      item: CreativeComponentMigrationDesignPlan;
      document: DesignDocument;
      truth: TaskTruthSnapshot;
      qa: ReturnType<typeof runDesignQa>;
    }> = [];

    for (const item of selected) {
      const project = await this.projects.get(item.designId);
      if (!project) throw new Error(`COMPONENT_MIGRATION_DESIGN_MISSING: ${item.designId}`);
      if (project.document.version !== item.sourceDesignVersion) {
        throw new Error(`COMPONENT_MIGRATION_DESIGN_STALE: ${item.designId} expected v${item.sourceDesignVersion}, found v${project.document.version}.`);
      }
      const approval = await this.governance.getApproval(project.document.id, project.document.version);
      if (approval) throw new Error(`COMPONENT_MIGRATION_FROZEN_APPROVED: ${item.designId} current version is approved.`);
      const currentInstances: CreativeComponentMigrationInstancePlan[] = item.instances.map((planned) => {
        const group = rootInstance(project.document, planned.instanceId);
        const currentComponentId = group.componentInstance!.componentId;
        const version = family.versions.find((entry) => entry.componentId === currentComponentId)?.version;
        if (!version) throw new Error(`COMPONENT_MIGRATION_INSTANCE_FAMILY_MISMATCH: ${planned.instanceId}`);
        return {
          instanceId: planned.instanceId,
          groupLayerId: group.id,
          currentComponentId,
          currentVersion: version,
          targetComponentId: input.plan.targetComponentId,
          targetVersion: input.plan.targetVersion,
        };
      });
      const precondition = designPrecondition({
        familyId: family.familyId,
        targetComponent,
        designId: project.document.id,
        designVersion: project.document.version,
        campaignId: project.document.campaignId,
        truthSnapshotId: project.document.truthSnapshotId,
        approved: false,
        instances: currentInstances,
      });
      if (precondition !== item.preconditionToken) {
        throw new Error(`COMPONENT_MIGRATION_PRECONDITION_STALE: ${item.designId} changed after the dry-run plan.`);
      }
      const truth = await campaignTruth(this.rootDir, project.document.campaignId);
      let migrated = project.document;
      for (const planned of item.instances) {
        const currentComponent = await this.lifecycle.components.get(
          input.plan.clientId,
          input.plan.brandId,
          planned.currentComponentId,
        );
        if (!currentComponent) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${planned.currentComponentId}`);
        migrated = replaceReusableComponentInstance({
          document: migrated,
          destinationTruth: truth,
          currentComponent,
          targetComponent,
          instanceId: planned.instanceId,
          timestamp,
        });
      }
      migrated = collapseMigrationRevision({
        source: project.document,
        migrated,
        instanceIds: item.instances.map((entry) => entry.instanceId),
        targetComponentId: targetComponent.id,
        timestamp,
      });
      const qa = runDesignQa({ document: migrated, truthSnapshot: truth });
      if (qa.decision === "BLOCK") {
        throw new Error(`COMPONENT_MIGRATION_QA_BLOCK: ${item.designId} deterministic QA blocked the proposed migration.`);
      }
      prepared.push({ item, document: migrated, truth, qa });
    }

    const executedDesigns: CreativeComponentMigrationExecutionDesign[] = [];
    for (const entry of prepared) {
      await this.projects.save(entry.document);
      await this.projects.saveQa(entry.document.id, {
        checkedAt: entry.qa.checkedAt,
        decision: entry.qa.decision,
        issues: entry.qa.issues,
      });
      executedDesigns.push({
        designId: entry.document.id,
        fromVersion: entry.item.sourceDesignVersion,
        toVersion: entry.document.version,
        itemId: entry.item.itemId,
        instanceIds: entry.item.instances.map((item) => item.instanceId),
        qaDecision: entry.qa.decision,
      });
    }

    const executionId = safeId(`migration-exec-${input.plan.planId}-${hash({ uniqueIds, timestamp }).slice(0, 12)}`, "executionId");
    const record: CreativeComponentMigrationExecutionRecord = {
      schemaVersion: 1,
      executionId,
      planId: input.plan.planId,
      familyId: input.plan.familyId,
      targetComponentId: input.plan.targetComponentId,
      targetVersion: input.plan.targetVersion,
      requestedItemIds: uniqueIds,
      executedDesigns,
      createdAt: timestamp,
    };
    return this.store.saveExecution({ clientId: input.plan.clientId, brandId: input.plan.brandId, record });
  }
}

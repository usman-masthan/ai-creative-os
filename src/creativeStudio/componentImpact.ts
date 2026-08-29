import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import type { DesignDocument, DesignGroupLayer, DesignTextLayer } from "../designDocument/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import type { CreativeReusableComponent } from "./componentLibrary.js";
import {
  type CreativeComponentFamilyRecord,
  FileCreativeComponentLifecycleStore,
  replaceReusableComponentInstance,
} from "./componentLifecycle.js";
import { CreativeStudioGovernanceStore } from "./governanceStore.js";
import { FileDesignProjectStore } from "./projectStore.js";

export type CreativeComponentImpactGovernance = "EDITABLE" | "FROZEN_APPROVED";
export type CreativeComponentUpgradeReadiness =
  | "CURRENT_TARGET"
  | "UPGRADEABLE"
  | "BLOCKED_TRUTH"
  | "BLOCKED_TEXT_ROLE"
  | "BLOCKED_VERSION"
  | "BLOCKED_STRUCTURE";

export interface CreativeComponentInstanceImpact {
  designId: string;
  designVersion: number;
  campaignId: string;
  instanceId: string;
  groupLayerId: string;
  currentComponentId: string;
  currentVersion: number;
  targetComponentId: string;
  targetVersion: number;
  governance: CreativeComponentImpactGovernance;
  upgradeReadiness: CreativeComponentUpgradeReadiness;
  missingTruthKeys: string[];
  missingTextRoles: string[];
  reason: string;
}

export interface CreativeComponentDesignImpact {
  designId: string;
  designVersion: number;
  campaignId: string;
  approvedCurrentVersion: boolean;
  instances: CreativeComponentInstanceImpact[];
}

export interface CreativeComponentImpactReport {
  schemaVersion: 1;
  familyId: string;
  familyStatus: CreativeComponentFamilyRecord["status"];
  clientId: string;
  brandId: string;
  targetComponentId: string;
  targetVersion: number;
  generatedAt: string;
  totals: {
    designs: number;
    instances: number;
    currentTarget: number;
    upgradeable: number;
    blocked: number;
    frozenApproved: number;
  };
  designs: CreativeComponentDesignImpact[];
  impactToken: string;
}

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot | undefined> {
  try {
    const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
    return truthSnapshotFromTrace(trace.truth);
  } catch {
    return undefined;
  }
}

function rootInstances(document: DesignDocument, componentIds: Set<string>): DesignGroupLayer[] {
  return document.layers.filter(
    (layer): layer is DesignGroupLayer => layer.type === "group"
      && layer.componentInstance?.templateLayerId === "group-root"
      && componentIds.has(layer.componentInstance.componentId),
  );
}

function targetTextRoles(component: CreativeReusableComponent): DesignTextLayer["role"][] {
  return component.templates
    .filter((template): template is Extract<CreativeReusableComponent["templates"][number], { type: "text" }> => template.type === "text")
    .map((template) => template.role);
}

function missingNativeTextRoles(document: DesignDocument, component: CreativeReusableComponent): string[] {
  const missing: string[] = [];
  for (const role of targetTextRoles(component)) {
    const count = document.layers.filter(
      (layer): layer is DesignTextLayer => layer.type === "text" && layer.role === role && !layer.componentInstance,
    ).length;
    if (count !== 1) missing.push(`${role}:${count}`);
  }
  return missing.sort();
}

function missingTruthKeys(snapshot: TaskTruthSnapshot | undefined, component: CreativeReusableComponent): string[] {
  if (!snapshot) return component.requiredTruthKeys.length ? [...component.requiredTruthKeys, "__taskTruthSnapshot__"].sort() : ["__taskTruthSnapshot__"];
  const present = new Set(snapshot.facts.map((fact) => fact.key));
  return component.requiredTruthKeys.filter((key) => !present.has(key)).sort();
}

function tokenFor(report: Omit<CreativeComponentImpactReport, "generatedAt" | "impactToken">, target: CreativeReusableComponent): string {
  const payload = JSON.stringify({
    report,
    target: {
      id: target.id,
      templates: target.templates,
      requiredTruthKeys: target.requiredTruthKeys,
      sourceDesignId: target.sourceDesignId,
      sourceDesignVersion: target.sourceDesignVersion,
      sourceTruthSnapshotId: target.sourceTruthSnapshotId,
    },
  });
  return createHash("sha256").update(payload).digest("hex");
}

export class FileCreativeComponentImpactAnalyzer {
  readonly rootDir: string;
  readonly projects: FileDesignProjectStore;
  readonly lifecycle: FileCreativeComponentLifecycleStore;
  readonly governance: CreativeStudioGovernanceStore;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.projects = new FileDesignProjectStore(rootDir);
    this.lifecycle = new FileCreativeComponentLifecycleStore(rootDir);
    this.governance = new CreativeStudioGovernanceStore(rootDir);
  }

  async analyze(input: {
    family: CreativeComponentFamilyRecord;
    targetComponent: CreativeReusableComponent;
    targetVersion: number;
    generatedAt?: string;
  }): Promise<CreativeComponentImpactReport> {
    if (!Number.isInteger(input.targetVersion) || input.targetVersion < 1) {
      throw new Error("COMPONENT_IMPACT_TARGET_VERSION_INVALID.");
    }
    if (input.targetComponent.clientId !== input.family.clientId || input.targetComponent.brandId !== input.family.brandId) {
      throw new Error("COMPONENT_IMPACT_BRAND_BOUNDARY_BLOCK: target component does not match the family client/brand.");
    }

    const versionByComponent = new Map(input.family.versions.map((entry) => [entry.componentId, entry.version]));
    const familyComponentIds = new Set(versionByComponent.keys());
    const projectStates = await this.projects.list();
    const designs: CreativeComponentDesignImpact[] = [];

    for (const state of projectStates) {
      const project = await this.projects.get(state.designId);
      if (!project) continue;
      const document = project.document;
      if (document.brand.clientId !== input.family.clientId || document.brand.brandId !== input.family.brandId) continue;
      const roots = rootInstances(document, familyComponentIds);
      if (!roots.length) continue;

      const [approval, truth] = await Promise.all([
        this.governance.getApproval(document.id, document.version),
        campaignTruth(this.rootDir, document.campaignId),
      ]);
      const approvedCurrentVersion = Boolean(approval);
      const impacts: CreativeComponentInstanceImpact[] = [];

      for (const group of roots) {
        const currentComponentId = group.componentInstance!.componentId;
        const currentVersion = versionByComponent.get(currentComponentId);
        if (!currentVersion) continue;
        const governance: CreativeComponentImpactGovernance = approvedCurrentVersion ? "FROZEN_APPROVED" : "EDITABLE";
        let upgradeReadiness: CreativeComponentUpgradeReadiness;
        let reason: string;
        let missingTruth: string[] = [];
        let missingRoles: string[] = [];

        if (currentVersion === input.targetVersion && currentComponentId === input.targetComponent.id) {
          upgradeReadiness = "CURRENT_TARGET";
          reason = "Instance already uses the analyzed target component version.";
        } else if (input.targetVersion <= currentVersion) {
          upgradeReadiness = "BLOCKED_VERSION";
          reason = "Target version is not newer than the attached instance.";
        } else {
          missingTruth = missingTruthKeys(truth, input.targetComponent);
          missingRoles = missingNativeTextRoles(document, input.targetComponent);
          if (missingTruth.length) {
            upgradeReadiness = "BLOCKED_TRUTH";
            reason = "Destination confirmed truth does not satisfy the target component requirements.";
          } else if (missingRoles.length) {
            upgradeReadiness = "BLOCKED_TEXT_ROLE";
            reason = "Destination native text-role contract does not satisfy the target component.";
          } else if (!truth) {
            upgradeReadiness = "BLOCKED_TRUTH";
            reason = "Destination immutable task truth snapshot is unavailable.";
          } else {
            const currentComponent = await this.lifecycle.components.get(
              input.family.clientId,
              input.family.brandId,
              currentComponentId,
            );
            if (!currentComponent) {
              upgradeReadiness = "BLOCKED_STRUCTURE";
              reason = "Current immutable component definition is missing.";
            } else {
              try {
                replaceReusableComponentInstance({
                  document,
                  destinationTruth: truth,
                  currentComponent,
                  targetComponent: input.targetComponent,
                  instanceId: group.componentInstance!.instanceId,
                  timestamp: document.updatedAt,
                });
                upgradeReadiness = "UPGRADEABLE";
                reason = approvedCurrentVersion
                  ? "Technical upgrade simulation passes, but the exact current design version is approved and should remain frozen until explicitly revised."
                  : "Governed in-memory upgrade simulation passes.";
              } catch (error) {
                upgradeReadiness = "BLOCKED_STRUCTURE";
                reason = error instanceof Error ? error.message : String(error);
              }
            }
          }
        }

        impacts.push({
          designId: document.id,
          designVersion: document.version,
          campaignId: document.campaignId,
          instanceId: group.componentInstance!.instanceId,
          groupLayerId: group.id,
          currentComponentId,
          currentVersion,
          targetComponentId: input.targetComponent.id,
          targetVersion: input.targetVersion,
          governance,
          upgradeReadiness,
          missingTruthKeys: missingTruth,
          missingTextRoles: missingRoles,
          reason,
        });
      }

      if (impacts.length) {
        designs.push({
          designId: document.id,
          designVersion: document.version,
          campaignId: document.campaignId,
          approvedCurrentVersion,
          instances: impacts,
        });
      }
    }

    designs.sort((a, b) => a.designId.localeCompare(b.designId));
    const instances = designs.flatMap((design) => design.instances);
    const unsigned: Omit<CreativeComponentImpactReport, "generatedAt" | "impactToken"> = {
      schemaVersion: 1,
      familyId: input.family.familyId,
      familyStatus: input.family.status,
      clientId: input.family.clientId,
      brandId: input.family.brandId,
      targetComponentId: input.targetComponent.id,
      targetVersion: input.targetVersion,
      totals: {
        designs: designs.length,
        instances: instances.length,
        currentTarget: instances.filter((item) => item.upgradeReadiness === "CURRENT_TARGET").length,
        upgradeable: instances.filter((item) => item.upgradeReadiness === "UPGRADEABLE").length,
        blocked: instances.filter((item) => item.upgradeReadiness.startsWith("BLOCKED_")).length,
        frozenApproved: instances.filter((item) => item.governance === "FROZEN_APPROVED").length,
      },
      designs,
    };
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    if (Number.isNaN(Date.parse(generatedAt))) throw new Error("COMPONENT_IMPACT_TIMESTAMP_INVALID.");
    return {
      ...unsigned,
      generatedAt,
      impactToken: tokenFor(unsigned, input.targetComponent),
    };
  }
}

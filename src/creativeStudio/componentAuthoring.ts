import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { DesignDocument } from "../designDocument/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import {
  createReusableComponent,
  type CreativeComponentLayerTemplate,
  type CreativeComponentTextTemplate,
  type CreativeReusableComponent,
} from "./componentLibrary.js";
import {
  type CreativeComponentFamilyRecord,
  FileCreativeComponentLifecycleStore,
} from "./componentLifecycle.js";

export type CreativeComponentCompatibility = "COMPATIBLE" | "REVIEW_REQUIRED" | "BLOCKED";

export interface CreativeComponentAuthoringDiff {
  templateCount: { before: number; after: number };
  textRoles: {
    added: string[];
    removed: string[];
    styleOrGeometryChanged: string[];
  };
  shapes: {
    before: number;
    after: number;
    styleOrGeometryChanged: boolean;
  };
  truthDependencies: {
    added: string[];
    removed: string[];
  };
}

export interface CreativeComponentVersionPreview {
  schemaVersion: 1;
  familyId: string;
  familyName: string;
  baseVersion: number;
  baseComponentId: string;
  proposedVersion: number;
  proposedComponentId: string;
  sourceDesignId: string;
  sourceDesignVersion: number;
  groupLayerId: string;
  compatibility: CreativeComponentCompatibility;
  issues: string[];
  diff: CreativeComponentAuthoringDiff;
  previewToken: string;
}

export interface CreativeComponentAuthoringRecord {
  version: number;
  componentId: string;
  baseComponentId: string;
  versionNotes: string;
  compatibility: Exclude<CreativeComponentCompatibility, "BLOCKED">;
  diff: CreativeComponentAuthoringDiff;
  sourceDesignId: string;
  sourceDesignVersion: number;
  sourceTruthSnapshotId: string;
  createdAt: string;
}

export interface CreativeComponentAuthoringAudit {
  schemaVersion: 1;
  familyId: string;
  clientId: string;
  brandId: string;
  records: CreativeComponentAuthoringRecord[];
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function safeNotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 500) {
    throw new Error("COMPONENT_VERSION_NOTES_REQUIRED: version notes must contain 5 to 500 characters.");
  }
  return trimmed;
}

function validDate(value: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error("component authoring createdAt must be an ISO date-time.");
  return value;
}

function textTemplates(component: CreativeReusableComponent): CreativeComponentTextTemplate[] {
  return component.templates.filter((template): template is CreativeComponentTextTemplate => template.type === "text");
}

function shapeTemplates(component: CreativeReusableComponent): CreativeComponentLayerTemplate[] {
  return component.templates.filter((template) => template.type === "shape");
}

function textSignature(template: CreativeComponentTextTemplate): string {
  return JSON.stringify({
    offsetX: template.offsetX,
    offsetY: template.offsetY,
    width: template.width,
    height: template.height,
    rotation: template.rotation,
    opacity: template.opacity,
    zOrder: template.zOrder,
    visible: template.visible,
    fontFamily: template.fontFamily,
    fontSize: template.fontSize,
    fontWeight: template.fontWeight,
    lineHeight: template.lineHeight,
    letterSpacing: template.letterSpacing,
    align: template.align,
    fill: template.fill,
    stroke: template.stroke ?? null,
    shadow: template.shadow ?? null,
  });
}

function shapeSignature(template: CreativeComponentLayerTemplate): string {
  if (template.type !== "shape") return "";
  return JSON.stringify({
    offsetX: template.offsetX,
    offsetY: template.offsetY,
    width: template.width,
    height: template.height,
    rotation: template.rotation,
    opacity: template.opacity,
    zOrder: template.zOrder,
    visible: template.visible,
    shape: template.shape,
    fill: template.fill ?? null,
    stroke: template.stroke ?? null,
    strokeWidth: template.strokeWidth ?? null,
    cornerRadius: template.cornerRadius ?? null,
  });
}

function difference(after: string[], before: string[]): string[] {
  const known = new Set(before);
  return [...new Set(after.filter((value) => !known.has(value)))].sort();
}

export function diffReusableComponents(
  base: CreativeReusableComponent,
  candidate: CreativeReusableComponent,
): CreativeComponentAuthoringDiff {
  const baseText = new Map(textTemplates(base).map((template) => [template.role, template]));
  const candidateText = new Map(textTemplates(candidate).map((template) => [template.role, template]));
  const beforeRoles = [...baseText.keys()].sort();
  const afterRoles = [...candidateText.keys()].sort();
  const commonRoles = afterRoles.filter((role) => baseText.has(role));
  const baseShapes = shapeTemplates(base).sort((a, b) => a.zOrder - b.zOrder);
  const candidateShapes = shapeTemplates(candidate).sort((a, b) => a.zOrder - b.zOrder);
  return {
    templateCount: { before: base.templates.length, after: candidate.templates.length },
    textRoles: {
      added: difference(afterRoles, beforeRoles),
      removed: difference(beforeRoles, afterRoles),
      styleOrGeometryChanged: commonRoles.filter((role) => {
        const before = baseText.get(role)!;
        const after = candidateText.get(role)!;
        return textSignature(before) !== textSignature(after);
      }).sort(),
    },
    shapes: {
      before: baseShapes.length,
      after: candidateShapes.length,
      styleOrGeometryChanged: JSON.stringify(baseShapes.map(shapeSignature)) !== JSON.stringify(candidateShapes.map(shapeSignature)),
    },
    truthDependencies: {
      added: difference(candidate.requiredTruthKeys, base.requiredTruthKeys),
      removed: difference(base.requiredTruthKeys, candidate.requiredTruthKeys),
    },
  };
}

function compatibilityFor(input: {
  family: CreativeComponentFamilyRecord;
  document: DesignDocument;
  base: CreativeReusableComponent;
  candidate: CreativeReusableComponent;
  diff: CreativeComponentAuthoringDiff;
}): { compatibility: CreativeComponentCompatibility; issues: string[] } {
  const issues: string[] = [];
  if (input.family.status !== "ACTIVE") issues.push(`Family is ${input.family.status}; only ACTIVE families can publish versions.`);
  if (input.family.latestComponentId !== input.base.id) issues.push("Base component is not the current latest family version.");
  if (input.family.clientId !== input.document.brand.clientId || input.family.brandId !== input.document.brand.brandId) {
    issues.push("Selected design does not match the component family's client and brand boundary.");
  }
  if (input.candidate.clientId !== input.family.clientId || input.candidate.brandId !== input.family.brandId) {
    issues.push("Candidate component crossed the component family's client or brand boundary.");
  }
  if (issues.length) return { compatibility: "BLOCKED", issues };

  const reviewIssues: string[] = [];
  if (input.diff.textRoles.added.length || input.diff.textRoles.removed.length) {
    reviewIssues.push("Text-role structure changed; destination role compatibility must be reviewed.");
  }
  if (input.diff.shapes.before !== input.diff.shapes.after) {
    reviewIssues.push("Shape-layer count changed.");
  }
  if (input.diff.truthDependencies.added.length || input.diff.truthDependencies.removed.length) {
    reviewIssues.push("Confirmed-truth dependencies changed.");
  }
  return reviewIssues.length
    ? { compatibility: "REVIEW_REQUIRED", issues: reviewIssues }
    : { compatibility: "COMPATIBLE", issues: [] };
}

function previewToken(input: Omit<CreativeComponentVersionPreview, "previewToken">, candidate: CreativeReusableComponent): string {
  const payload = JSON.stringify({
    preview: input,
    candidate: {
      templates: candidate.templates,
      requiredTruthKeys: candidate.requiredTruthKeys,
      sourceDesignId: candidate.sourceDesignId,
      sourceDesignVersion: candidate.sourceDesignVersion,
      sourceTruthSnapshotId: candidate.sourceTruthSnapshotId,
    },
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function previewReusableComponentVersion(input: {
  document: DesignDocument;
  sourceTruth: TaskTruthSnapshot;
  groupLayerId: string;
  family: CreativeComponentFamilyRecord;
  baseComponent: CreativeReusableComponent;
}): { preview: CreativeComponentVersionPreview; candidate: CreativeReusableComponent } {
  const proposedVersion = input.family.latestVersion + 1;
  const proposedComponentId = safeId(`${input.family.familyId}.v${proposedVersion}`, "proposedComponentId");
  const candidate = createReusableComponent({
    document: input.document,
    sourceTruth: input.sourceTruth,
    groupLayerId: safeId(input.groupLayerId, "groupLayerId"),
    componentId: proposedComponentId,
    name: input.family.name,
    createdAt: input.document.updatedAt,
  });
  const diff = diffReusableComponents(input.baseComponent, candidate);
  const result = compatibilityFor({
    family: input.family,
    document: input.document,
    base: input.baseComponent,
    candidate,
    diff,
  });
  const unsigned: Omit<CreativeComponentVersionPreview, "previewToken"> = {
    schemaVersion: 1,
    familyId: input.family.familyId,
    familyName: input.family.name,
    baseVersion: input.family.latestVersion,
    baseComponentId: input.family.latestComponentId,
    proposedVersion,
    proposedComponentId,
    sourceDesignId: input.document.id,
    sourceDesignVersion: input.document.version,
    groupLayerId: safeId(input.groupLayerId, "groupLayerId"),
    compatibility: result.compatibility,
    issues: result.issues,
    diff,
  };
  return { preview: { ...unsigned, previewToken: previewToken(unsigned, candidate) }, candidate };
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export class FileCreativeComponentAuthoringStore {
  readonly rootDir: string;
  readonly lifecycle: FileCreativeComponentLifecycleStore;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.lifecycle = new FileCreativeComponentLifecycleStore(rootDir);
  }

  private familyPath(clientId: string, brandId: string, familyId: string): string {
    return join(this.rootDir, "components", safeId(clientId, "clientId"), safeId(brandId, "brandId"), "_families", `${safeId(familyId, "familyId")}.json`);
  }

  private auditPath(clientId: string, brandId: string, familyId: string): string {
    return join(this.rootDir, "components", safeId(clientId, "clientId"), safeId(brandId, "brandId"), "_authoring", `${safeId(familyId, "familyId")}.json`);
  }

  async getAudit(clientId: string, brandId: string, familyId: string): Promise<CreativeComponentAuthoringAudit> {
    return (await readJson<CreativeComponentAuthoringAudit>(this.auditPath(clientId, brandId, familyId))) ?? {
      schemaVersion: 1,
      familyId: safeId(familyId, "familyId"),
      clientId: safeId(clientId, "clientId"),
      brandId: safeId(brandId, "brandId"),
      records: [],
    };
  }

  async publish(input: {
    document: DesignDocument;
    sourceTruth: TaskTruthSnapshot;
    groupLayerId: string;
    familyId: string;
    expectedBaseComponentId: string;
    expectedPreviewToken: string;
    versionNotes: string;
    acceptReviewRequired: boolean;
    createdAt?: string;
  }): Promise<{
    component: CreativeReusableComponent;
    family: CreativeComponentFamilyRecord;
    record: CreativeComponentAuthoringRecord;
    preview: CreativeComponentVersionPreview;
  }> {
    const familyId = safeId(input.familyId, "familyId");
    const family = await this.lifecycle.get(input.document.brand.clientId, input.document.brand.brandId, familyId);
    if (!family) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${familyId}`);
    if (family.latestComponentId !== safeId(input.expectedBaseComponentId, "expectedBaseComponentId")) {
      throw new Error("COMPONENT_AUTHORING_STALE_BASE: family latest version changed after preview.");
    }
    const base = await this.lifecycle.components.get(family.clientId, family.brandId, family.latestComponentId);
    if (!base) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${family.latestComponentId}`);
    const { preview, candidate: previewCandidate } = previewReusableComponentVersion({
      document: input.document,
      sourceTruth: input.sourceTruth,
      groupLayerId: input.groupLayerId,
      family,
      baseComponent: base,
    });
    if (preview.previewToken !== input.expectedPreviewToken.trim()) {
      throw new Error("COMPONENT_AUTHORING_STALE_PREVIEW: selected group or design changed after preview.");
    }
    if (preview.compatibility === "BLOCKED") {
      throw new Error(`COMPONENT_AUTHORING_BLOCKED: ${preview.issues.join(" ")}`);
    }
    if (preview.compatibility === "REVIEW_REQUIRED" && !input.acceptReviewRequired) {
      throw new Error("COMPONENT_AUTHORING_REVIEW_REQUIRED: acknowledge the compatibility review before publishing.");
    }
    const versionNotes = safeNotes(input.versionNotes);
    const createdAt = validDate(input.createdAt ?? new Date().toISOString());
    const component: CreativeReusableComponent = {
      ...previewCandidate,
      createdAt,
    };
    await this.lifecycle.components.save(component);

    const nextFamily: CreativeComponentFamilyRecord = {
      ...family,
      latestVersion: preview.proposedVersion,
      latestComponentId: component.id,
      versions: [
        ...family.versions,
        {
          version: preview.proposedVersion,
          componentId: component.id,
          createdAt,
          derivedFromComponentId: family.latestComponentId,
        },
      ],
      updatedAt: createdAt,
    };
    await mkdir(join(this.rootDir, "components", family.clientId, family.brandId, "_families"), { recursive: true });
    await writeFile(this.familyPath(family.clientId, family.brandId, family.familyId), `${JSON.stringify(nextFamily, null, 2)}\n`, "utf8");
    const validatedFamily = await this.lifecycle.get(family.clientId, family.brandId, family.familyId);
    if (!validatedFamily || validatedFamily.latestComponentId !== component.id) {
      throw new Error("COMPONENT_AUTHORING_FAMILY_WRITE_FAILED: published component was not registered as latest.");
    }

    const audit = await this.getAudit(family.clientId, family.brandId, family.familyId);
    const record: CreativeComponentAuthoringRecord = {
      version: preview.proposedVersion,
      componentId: component.id,
      baseComponentId: family.latestComponentId,
      versionNotes,
      compatibility: preview.compatibility,
      diff: preview.diff,
      sourceDesignId: input.document.id,
      sourceDesignVersion: input.document.version,
      sourceTruthSnapshotId: input.document.truthSnapshotId,
      createdAt,
    };
    const nextAudit: CreativeComponentAuthoringAudit = {
      ...audit,
      records: [...audit.records, record],
    };
    const auditDir = join(this.rootDir, "components", family.clientId, family.brandId, "_authoring");
    await mkdir(auditDir, { recursive: true });
    await writeFile(this.auditPath(family.clientId, family.brandId, family.familyId), `${JSON.stringify(nextAudit, null, 2)}\n`, "utf8");
    return { component, family: validatedFamily, record, preview };
  }
}

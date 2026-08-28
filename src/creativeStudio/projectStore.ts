import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { CreativeBrief } from "./contracts/creativeBrief.js";
import { assertCreativeBrief } from "./contracts/creativeBrief.js";
import type { LayeredCreativeDirectorReview } from "../creativeDirectorLayered.js";
import type { DesignDocument } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";

export interface DesignQaRecord {
  checkedAt: string;
  decision: "PASS" | "WARN" | "BLOCK";
  issues: unknown[];
}

export interface DesignExportRecord {
  exportedAt: string;
  format: "png" | "jpg" | "svg";
  preset: "standard" | "high-resolution" | "4k" | "custom";
  path: string;
  width: number;
  height: number;
}

export interface DesignProjectState {
  schemaVersion: 1;
  designId: string;
  campaignId: string;
  currentVersion: number;
  maxVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DesignProjectSnapshot {
  state: DesignProjectState;
  document: DesignDocument;
  brief?: CreativeBrief;
  qa?: DesignQaRecord;
  directorReview?: LayeredCreativeDirectorReview;
  exports: DesignExportRecord[];
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return trimmed;
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

export class FileDesignProjectStore {
  readonly rootDir: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
  }

  private projectDir(designId: string): string {
    return join(this.rootDir, "designs", safeId(designId, "designId"));
  }

  private path(designId: string, file: string): string {
    return join(this.projectDir(designId), file);
  }

  private versionPath(designId: string, version: number): string {
    if (!Number.isInteger(version) || version < 1) throw new Error("Design version must be a positive integer.");
    return join(this.projectDir(designId), "versions", `${version}.json`);
  }

  private async ensureProject(designId: string): Promise<void> {
    await mkdir(join(this.projectDir(designId), "versions"), { recursive: true });
  }

  async create(input: { document: DesignDocument; brief?: CreativeBrief }): Promise<DesignProjectSnapshot> {
    const document = assertDesignDocument(input.document);
    const existing = await this.getState(document.id);
    if (existing) throw new Error(`Design project ${document.id} already exists.`);
    await this.ensureProject(document.id);
    const now = document.createdAt;
    const state: DesignProjectState = {
      schemaVersion: 1,
      designId: document.id,
      campaignId: document.campaignId,
      currentVersion: document.version,
      maxVersion: document.version,
      createdAt: now,
      updatedAt: document.updatedAt,
    };
    await Promise.all([
      writeJson(this.path(document.id, "state.json"), state),
      writeJson(this.path(document.id, "design.json"), document),
      writeJson(this.versionPath(document.id, document.version), document),
      input.brief
        ? writeJson(this.path(document.id, "brief.json"), assertCreativeBrief(input.brief))
        : Promise.resolve(),
      writeJson(this.path(document.id, "exports.json"), []),
    ]);
    return this.get(document.id) as Promise<DesignProjectSnapshot>;
  }

  async getState(designId: string): Promise<DesignProjectState | undefined> {
    const state = await readJson<DesignProjectState | null>(this.path(designId, "state.json"), null);
    return state ?? undefined;
  }

  async get(designId: string): Promise<DesignProjectSnapshot | undefined> {
    const state = await this.getState(designId);
    if (!state) return undefined;
    const [documentRaw, briefRaw, qaRaw, directorReview, exports] = await Promise.all([
      readJson<DesignDocument | null>(this.path(designId, "design.json"), null),
      readJson<CreativeBrief | null>(this.path(designId, "brief.json"), null),
      readJson<DesignQaRecord | null>(this.path(designId, "qa.json"), null),
      readJson<LayeredCreativeDirectorReview | null>(this.path(designId, "director-review.json"), null),
      readJson<DesignExportRecord[]>(this.path(designId, "exports.json"), []),
    ]);
    if (!documentRaw) throw new Error(`Design project ${designId} is missing design.json.`);
    return {
      state,
      document: assertDesignDocument(documentRaw),
      ...(briefRaw ? { brief: assertCreativeBrief(briefRaw) } : {}),
      ...(qaRaw ? { qa: qaRaw } : {}),
      ...(directorReview ? { directorReview } : {}),
      exports,
    };
  }

  async save(documentInput: DesignDocument): Promise<DesignProjectSnapshot> {
    const document = assertDesignDocument(documentInput);
    const state = await this.getState(document.id);
    if (!state) throw new Error(`Design project ${document.id} does not exist.`);
    if (document.campaignId !== state.campaignId) {
      throw new Error("Design campaign binding cannot be changed.");
    }
    if (document.version !== state.currentVersion + 1) {
      throw new Error(
        `Design save requires version ${state.currentVersion + 1}; received ${document.version}.`,
      );
    }
    await this.ensureProject(document.id);
    const nextState: DesignProjectState = {
      ...state,
      currentVersion: document.version,
      maxVersion: document.version,
      updatedAt: document.updatedAt,
    };
    await Promise.all([
      writeJson(this.path(document.id, "state.json"), nextState),
      writeJson(this.path(document.id, "design.json"), document),
      writeJson(this.versionPath(document.id, document.version), document),
    ]);
    return this.get(document.id) as Promise<DesignProjectSnapshot>;
  }

  async undo(designId: string): Promise<DesignProjectSnapshot> {
    const state = await this.getState(designId);
    if (!state) throw new Error(`Design project ${designId} does not exist.`);
    if (state.currentVersion <= 1) throw new Error("UNDO_UNAVAILABLE: already at the first design version.");
    return this.restoreCursor(designId, state.currentVersion - 1, state);
  }

  async redo(designId: string): Promise<DesignProjectSnapshot> {
    const state = await this.getState(designId);
    if (!state) throw new Error(`Design project ${designId} does not exist.`);
    if (state.currentVersion >= state.maxVersion) throw new Error("REDO_UNAVAILABLE: no newer design version exists.");
    return this.restoreCursor(designId, state.currentVersion + 1, state);
  }

  private async restoreCursor(
    designId: string,
    version: number,
    state: DesignProjectState,
  ): Promise<DesignProjectSnapshot> {
    const documentRaw = await readJson<DesignDocument | null>(this.versionPath(designId, version), null);
    if (!documentRaw) throw new Error(`Design version ${version} is missing.`);
    const document = assertDesignDocument(documentRaw);
    const nextState: DesignProjectState = {
      ...state,
      currentVersion: version,
      updatedAt: new Date().toISOString(),
    };
    await Promise.all([
      writeJson(this.path(designId, "state.json"), nextState),
      writeJson(this.path(designId, "design.json"), document),
    ]);
    return this.get(designId) as Promise<DesignProjectSnapshot>;
  }

  async saveQa(designId: string, qa: DesignQaRecord): Promise<void> {
    if (!(await this.getState(designId))) throw new Error(`Design project ${designId} does not exist.`);
    await writeJson(this.path(designId, "qa.json"), qa);
  }

  async saveDirectorReview(designId: string, review: LayeredCreativeDirectorReview): Promise<void> {
    if (!(await this.getState(designId))) throw new Error(`Design project ${designId} does not exist.`);
    await writeJson(this.path(designId, "director-review.json"), review);
  }

  async appendExport(designId: string, record: DesignExportRecord): Promise<void> {
    if (!(await this.getState(designId))) throw new Error(`Design project ${designId} does not exist.`);
    const records = await readJson<DesignExportRecord[]>(this.path(designId, "exports.json"), []);
    records.push(record);
    await writeJson(this.path(designId, "exports.json"), records);
  }

  async list(): Promise<DesignProjectState[]> {
    const root = join(this.rootDir, "designs");
    let names: string[];
    try {
      names = await readdir(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const states = await Promise.all(names.map((name) => this.getState(name)));
    return states.filter((value): value is DesignProjectState => Boolean(value));
  }
}

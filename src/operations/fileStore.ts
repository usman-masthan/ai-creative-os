import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type {
  AssetRecord,
  CampaignLifecycleEvent,
  CampaignPerformanceRecord,
  CampaignRecord,
  CampaignRevision,
  CampaignSnapshot,
  CampaignSpendEntry,
  PublicationRecord,
} from "./types.js";

export interface CampaignStore {
  createCampaign(record: CampaignRecord): Promise<void>;
  getCampaign(campaignId: string): Promise<CampaignRecord | undefined>;
  updateCampaign(record: CampaignRecord): Promise<void>;
  appendRevision(record: CampaignRevision): Promise<void>;
  appendEvent(record: CampaignLifecycleEvent): Promise<void>;
  appendAsset(record: AssetRecord): Promise<void>;
  appendSpend(record: CampaignSpendEntry): Promise<void>;
  appendPublication(record: PublicationRecord): Promise<void>;
  appendPerformance(record: CampaignPerformanceRecord): Promise<void>;
  getSnapshot(campaignId: string): Promise<CampaignSnapshot | undefined>;
  listCampaigns(): Promise<CampaignRecord[]>;
}

function safeId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    throw new Error(`Unsafe campaign identifier: ${value}`);
  }
  return trimmed;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export class FileCampaignStore implements CampaignStore {
  readonly rootDir: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
  }

  private campaignDir(campaignId: string): string {
    return join(this.rootDir, "campaigns", safeId(campaignId));
  }

  private async ensureCampaignDir(campaignId: string): Promise<string> {
    const dir = this.campaignDir(campaignId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  private path(campaignId: string, file: string): string {
    return join(this.campaignDir(campaignId), file);
  }

  async createCampaign(record: CampaignRecord): Promise<void> {
    const existing = await this.getCampaign(record.campaignId);
    if (existing) throw new Error(`Campaign ${record.campaignId} already exists.`);
    await this.ensureCampaignDir(record.campaignId);
    await writeJson(this.path(record.campaignId, "campaign.json"), record);
  }

  async getCampaign(campaignId: string): Promise<CampaignRecord | undefined> {
    const value = await readJson<CampaignRecord | null>(
      this.path(campaignId, "campaign.json"),
      null,
    );
    return value ?? undefined;
  }

  async updateCampaign(record: CampaignRecord): Promise<void> {
    if (!(await this.getCampaign(record.campaignId))) {
      throw new Error(`Campaign ${record.campaignId} does not exist.`);
    }
    await writeJson(this.path(record.campaignId, "campaign.json"), record);
  }

  private async append<T>(campaignId: string, file: string, record: T): Promise<void> {
    await this.ensureCampaignDir(campaignId);
    const path = this.path(campaignId, file);
    const values = await readJson<T[]>(path, []);
    values.push(record);
    await writeJson(path, values);
  }

  async appendRevision(record: CampaignRevision): Promise<void> {
    await this.append(record.campaignId, "revisions.json", record);
  }

  async appendEvent(record: CampaignLifecycleEvent): Promise<void> {
    await this.append(record.campaignId, "events.json", record);
  }

  async appendAsset(record: AssetRecord): Promise<void> {
    await this.append(record.campaignId, "assets.json", record);
  }

  async appendSpend(record: CampaignSpendEntry): Promise<void> {
    if (!Number.isFinite(record.amountUsd) || record.amountUsd < 0) {
      throw new Error("Campaign spend amount must be a finite non-negative number.");
    }
    await this.append(record.campaignId, "spend.json", record);
  }

  async appendPublication(record: PublicationRecord): Promise<void> {
    await this.append(record.campaignId, "publications.json", record);
  }

  async appendPerformance(record: CampaignPerformanceRecord): Promise<void> {
    await this.append(record.campaignId, "performance.json", record);
  }

  async getSnapshot(campaignId: string): Promise<CampaignSnapshot | undefined> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) return undefined;
    const [revisions, events, assets, spend, publications, performance] = await Promise.all([
      readJson<CampaignRevision[]>(this.path(campaignId, "revisions.json"), []),
      readJson<CampaignLifecycleEvent[]>(this.path(campaignId, "events.json"), []),
      readJson<AssetRecord[]>(this.path(campaignId, "assets.json"), []),
      readJson<CampaignSpendEntry[]>(this.path(campaignId, "spend.json"), []),
      readJson<PublicationRecord[]>(this.path(campaignId, "publications.json"), []),
      readJson<CampaignPerformanceRecord[]>(this.path(campaignId, "performance.json"), []),
    ]);
    return { campaign, revisions, events, assets, spend, publications, performance };
  }

  async listCampaigns(): Promise<CampaignRecord[]> {
    const campaignsRoot = join(this.rootDir, "campaigns");
    let dirs: string[];
    try {
      dirs = await readdir(campaignsRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const values = await Promise.all(dirs.map((id) => this.getCampaign(id)));
    return values.filter((value): value is CampaignRecord => Boolean(value));
  }
}

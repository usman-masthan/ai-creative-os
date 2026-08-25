import { createHash } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { CampaignGenerationProvider } from "../providers/types.js";
import type { GeminiUsageTelemetry } from "../providers/geminiUsage.js";

export interface ProviderUsageLogEntry {
  timestamp: string;
  campaignId?: string;
  stage: string;
  provider: string;
  model: string;
  promptSha256: string;
  promptChars: number;
  outputSha256: string;
  outputChars: number;
  usage?: GeminiUsageTelemetry;
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export class JsonlUsageLogger {
  readonly filePath: string;

  constructor(filePath = ".atthas-os/usage/provider-usage.jsonl") {
    this.filePath = resolve(filePath);
  }

  async append(entry: ProviderUsageLogEntry): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

export class LoggingCampaignProvider implements CampaignGenerationProvider {
  readonly providerName: string;
  readonly model: string;

  constructor(
    private readonly inner: CampaignGenerationProvider,
    private readonly logger: JsonlUsageLogger,
    private readonly stage: string,
    private readonly campaignId?: string,
  ) {
    this.providerName = inner.providerName;
    this.model = inner.model;
  }

  async generate(prompt: string): Promise<string> {
    const output = await this.inner.generate(prompt);
    const usage = (this.inner as { lastUsage?: GeminiUsageTelemetry }).lastUsage;
    await this.logger.append({
      timestamp: new Date().toISOString(),
      ...(this.campaignId ? { campaignId: this.campaignId } : {}),
      stage: this.stage,
      provider: this.providerName,
      model: this.model,
      promptSha256: sha(prompt),
      promptChars: prompt.length,
      outputSha256: sha(output),
      outputChars: output.length,
      ...(usage ? { usage } : {}),
    });
    return output;
  }
}

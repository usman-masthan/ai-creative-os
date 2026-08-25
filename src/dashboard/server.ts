import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { FileCampaignStore } from "../operations/fileStore.js";
import { CampaignWorkflow } from "../operations/workflow.js";
import type { CampaignActorRole, CampaignLifecycleState } from "../operations/types.js";
import { computeAtthasValidationMetrics } from "../validationMetrics.js";

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function html(res: ServerResponse, value: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(value);
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]!);
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

export function createAtthasDashboardServer(options: { rootDir?: string } = {}) {
  const store = new FileCampaignStore(options.rootDir);
  const workflow = new CampaignWorkflow(store);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/health") {
        return json(res, 200, { ok: true, service: "atthas-creative-os" });
      }

      if (req.method === "GET" && url.pathname === "/api/campaigns") {
        const campaigns = await store.listCampaigns();
        return json(res, 200, campaigns);
      }

      const snapshotMatch = url.pathname.match(/^\/api\/campaign\/([^/]+)$/);
      if (req.method === "GET" && snapshotMatch) {
        const snapshot = await store.getSnapshot(decodeURIComponent(snapshotMatch[1]!));
        return snapshot ? json(res, 200, snapshot) : json(res, 404, { error: "campaign_not_found" });
      }

      if (req.method === "POST" && url.pathname === "/api/campaigns") {
        const data = await body(req);
        const record = await workflow.create({
          campaignId: requiredString(data.campaignId, "campaignId"),
          brandId: requiredString(data.brandId, "brandId") as "ATTHAS_BURGER" | "ATTHAS_RESTAURANT",
          ...(typeof data.branchId === "string" && data.branchId.trim() ? { branchId: data.branchId.trim() } : {}),
          truthVersion: requiredString(data.truthVersion, "truthVersion"),
          brandVersion: requiredString(data.brandVersion, "brandVersion"),
          ...(typeof data.selectedConceptId === "string" && data.selectedConceptId.trim()
            ? { selectedConceptId: data.selectedConceptId.trim() }
            : {}),
        });
        return json(res, 201, record);
      }

      const transitionMatch = url.pathname.match(/^\/api\/campaign\/([^/]+)\/transition$/);
      if (req.method === "POST" && transitionMatch) {
        const data = await body(req);
        const updated = await workflow.transition({
          campaignId: decodeURIComponent(transitionMatch[1]!),
          to: requiredString(data.to, "to") as CampaignLifecycleState,
          actorId: requiredString(data.actorId, "actorId"),
          actorRole: requiredString(data.actorRole, "actorRole") as CampaignActorRole,
          ...(typeof data.note === "string" && data.note.trim() ? { note: data.note.trim() } : {}),
          ...(data.productionEvidence && typeof data.productionEvidence === "object"
            ? { productionEvidence: data.productionEvidence as { hasFinalAsset: boolean; visualQaPassed: boolean; finalArtQaPassed: boolean } }
            : {}),
        });
        return json(res, 200, updated);
      }

      const revisionMatch = url.pathname.match(/^\/api\/campaign\/([^/]+)\/revision$/);
      if (req.method === "POST" && revisionMatch) {
        const data = await body(req);
        const revision = await workflow.addRevision({
          campaignId: decodeURIComponent(revisionMatch[1]!),
          createdBy: requiredString(data.createdBy, "createdBy"),
          summary: requiredString(data.summary, "summary"),
          ...(typeof data.reason === "string" && data.reason.trim() ? { reason: data.reason.trim() } : {}),
          ...(Array.isArray(data.assetIds) ? { assetIds: data.assetIds.filter((item): item is string => typeof item === "string") } : {}),
          ...(typeof data.visualQaDecision === "string" ? { visualQaDecision: data.visualQaDecision } : {}),
          ...(typeof data.finalArtQaDecision === "string" ? { finalArtQaDecision: data.finalArtQaDecision } : {}),
        });
        return json(res, 201, revision);
      }

      if (req.method === "GET" && url.pathname === "/") {
        const campaigns = await store.listCampaigns();
        const snapshots = (await Promise.all(campaigns.map((item) => store.getSnapshot(item.campaignId))))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const metrics = computeAtthasValidationMetrics(snapshots);
        const rows = snapshots.map((snapshot) => {
          const spend = snapshot.spend.reduce((sum, entry) => sum + entry.amountUsd, 0);
          return `<tr><td><a href="/api/campaign/${encodeURIComponent(snapshot.campaign.campaignId)}">${escape(snapshot.campaign.campaignId)}</a></td><td>${escape(snapshot.campaign.brandId)}</td><td>${escape(snapshot.campaign.state)}</td><td>${snapshot.campaign.currentRevision}</td><td>$${spend.toFixed(4)}</td><td>${snapshot.publications.length}</td></tr>`;
        }).join("");
        return html(res, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATTHA’S Creative OS</title><style>body{font-family:Inter,Arial,sans-serif;background:#171717;color:#fff;margin:0;padding:32px}h1{color:#FFD21A} .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:24px 0}.card{background:#242424;border:1px solid #3a3a3a;border-radius:12px;padding:16px}.n{font-size:28px;font-weight:700;color:#FFD21A}table{width:100%;border-collapse:collapse;background:#202020}th,td{padding:12px;border-bottom:1px solid #383838;text-align:left}th{color:#FFD21A}a{color:#FFD21A}small{color:#bbb}</style></head><body><h1>ATTHA’S Creative OS</h1><small>Internal operations dashboard — campaign lifecycle, revisions, spend, publication and validation.</small><div class="cards"><div class="card"><div class="n">${metrics.campaigns}</div>Campaigns</div><div class="card"><div class="n">${metrics.publicationCount}</div>Publications</div><div class="card"><div class="n">$${metrics.totalSpendUsd.toFixed(4)}</div>Total tracked spend</div><div class="card"><div class="n">${Math.round(metrics.productionReadyRate * 100)}%</div>Production-ready rate</div></div><table><thead><tr><th>Campaign</th><th>Brand</th><th>State</th><th>Revision</th><th>Spend</th><th>Published assets</th></tr></thead><tbody>${rows || "<tr><td colspan=6>No campaigns persisted yet.</td></tr>"}</tbody></table><p><small>JSON API: GET/POST /api/campaigns · GET /api/campaign/:id · POST /api/campaign/:id/transition · POST /api/campaign/:id/revision</small></p></body></html>`);
      }

      json(res, 404, { error: "not_found" });
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

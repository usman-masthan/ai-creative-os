import test from "node:test";
import assert from "node:assert/strict";

import { creativeStudioFinalHtml } from "../src/dashboard/creativeStudioFinalHtml.js";
import { creativeStudioProfiledHtml } from "../src/dashboard/creativeStudioProfiledHtml.js";

test("final Studio UI exposes flattened QA, approval, campaign handoff and migration controls", () => {
  const html = creativeStudioFinalHtml();
  assert.match(html, /id="visualQaBtn"/);
  assert.match(html, /id="parityBtn"/);
  assert.match(html, /id="approvalBadge"/);
  assert.match(html, /id="approveVersionBtn"/);
  assert.match(html, /id="approvedExportBtn"/);
  assert.match(html, /id="registerCampaignAssetBtn"/);
  assert.match(html, /\/api\/studio\/final-visual-qa/);
  assert.match(html, /\/api\/studio\/approval\?designId=/);
  assert.match(html, /\/api\/studio\/approve-version/);
  assert.match(html, /\/api\/studio\/export-approved/);
  assert.match(html, /\/api\/studio\/register-approved-asset/);
  assert.match(html, /\/api\/studio\/parity\?designId=/);
  assert.match(html, /Any later edit will require a new visual QA and approval/);
  assert.match(html, /campaign remains/);
  assert.match(html, /id="directionsBtn"/);
  assert.match(html, /id="directionModal"/);
  assert.match(html, /Generate 3 Directions/);
  assert.match(html, /Apply Safe Auto-Polish/);
});

test("active Studio intake resolves client, brand-kit and truth provider metadata from profiles", () => {
  const html = creativeStudioProfiledHtml();
  assert.match(html, /data-client-id="T001"/);
  assert.match(html, /data-brand-kit-id="ATTHAS_WORKING_V1"/);
  assert.match(html, /data-truth-provider-id="ATTHAS_UI_TRUTH_V1"/);
  assert.match(html, /fetch\('\/api\/studio\/bootstrap'\)/);
  assert.match(html, /option\.dataset\.clientId=profile\.clientId/);
  assert.match(html, /option\.dataset\.brandKitId=profile\.defaultBrandKitId/);
  assert.match(html, /option\.dataset\.truthPrepare=truth\.endpoints\.prepare/);
  assert.match(html, /option\.dataset\.truthConfirm=truth\.endpoints\.confirm/);
  assert.match(html, /option\.dataset\.truthUpload=truth\.endpoints\.upload/);
  assert.match(html, /option\.dataset\.truthProduce=truth\.endpoints\.produce/);
  assert.match(html, /api\(truthEndpoint\('prepare'\)/);
  assert.match(html, /api\(truthEndpoint\('confirm'\)/);
  assert.match(html, /api\(truthEndpoint\('upload'\)/);
  assert.match(html, /api\(truthEndpoint\('produce'\)/);
  assert.match(html, /api\(truthEndpoint\('bootstrap'\)\)/);
  assert.match(html, /reloadTruthBootstrap/);
  assert.match(html, /clientId:\$\('brandId'\)\.selectedOptions\[0\]\.dataset\.clientId/);
  assert.match(html, /brandKitId:\$\('brandId'\)\.selectedOptions\[0\]\.dataset\.brandKitId/);
  assert.doesNotMatch(html, /clientId:'T001',brandId:/);
  assert.doesNotMatch(html, /brandKitId:'ATTHAS_WORKING_V1',createdAt:/);
});

test("Studio generation creates and audits Creative Orchestration in governed order", () => {
  const html = creativeStudioProfiledHtml();
  const confirm = html.indexOf("var confirmed=await api(truthEndpoint('confirm')");
  const bindTruth = html.indexOf("state.brief.truthSnapshotId='task:'+state.snapshot.sessionId");
  const orchestrate = html.indexOf("state.orchestration=await api('/api/studio/orchestrate'");
  const produce = html.indexOf("var result=await api(truthEndpoint('produce')");
  const open = html.indexOf("var project=await api('/api/studio/open'");
  const link = html.indexOf("var orchestrationLink=await api('/api/studio/orchestration/link'");
  const complete = html.indexOf("var orchestrationExecution=await api('/api/studio/orchestration/complete'");
  const load = html.indexOf("loadProject(project);", complete);
  assert.ok(confirm >= 0);
  assert.ok(bindTruth > confirm);
  assert.ok(orchestrate > bindTruth);
  assert.ok(produce > orchestrate);
  assert.ok(open > produce);
  assert.ok(link > open);
  assert.ok(complete > link);
  assert.ok(load > complete);
  assert.match(html, /taskTruthSnapshot:state\.snapshot/);
  assert.match(html, /READY_FOR_GOVERNED_PRODUCTION/);
  assert.match(html, /extraModelCallsAddedByOrchestrator!==0/);
  assert.match(html, /project\.orchestration=state\.orchestration/);
  assert.match(html, /project\.orchestrationExecution=orchestrationExecution/);
});

from pathlib import Path
import re

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    p.write_text(text.replace(old, new, 1))


def re_replace_once(path: str, pattern: str, repl: str) -> None:
    p = ROOT / path
    text = p.read_text()
    out, count = re.subn(pattern, repl, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex match, found {count}: {pattern[:100]}')
    p.write_text(out)


workspace_module = r'''import type { CreativeFeatureFlags } from "../featureFlags.js";
import type {
  TaskTruthAnswer,
  TaskTruthQuestionnaire,
  TaskTruthSnapshot,
} from "../taskTruth.js";
import type { PlannedVisualQaContext } from "../commands/producePlannedCampaign.js";

export const WORKSPACE_PRODUCTION_PROFILE: Readonly<CreativeFeatureFlags> = Object.freeze({
  useStructuredBrief: true,
  useFoodComposer: true,
  useNewRenderer: true,
});

export const WORKSPACE_PRODUCT_VISUAL_SOURCES = [
  "APPROVED_REAL_PRODUCT_PHOTO",
  "AI_GENERATION_ALLOWED",
] as const;

export type WorkspaceProductVisualSource = (typeof WORKSPACE_PRODUCT_VISUAL_SOURCES)[number];

export interface WorkspaceUploadedAsset {
  schemaVersion: 1;
  assetId: string;
  sessionId: string;
  campaignId: string;
  filename: string;
  path: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  bytes: number;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  branchId?: string;
  productId?: string;
  sourceType: "owner_supplied";
  approvedForAds: boolean;
  appearanceVerified: boolean;
  ingredientMatchVerified: boolean;
  createdAt: string;
}

const BOOLEAN_KEYS = new Set(["branchAvailability"]);
const NUMBER_KEYS = new Set(["price"]);
const ARRAY_KEYS = new Set([
  "ingredients",
  "mustInclude",
  "mustNotInclude",
  "cookingMethods",
  "requestedProductClaims",
]);

function normalizedString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} requires a non-empty value.`);
  }
  return value.trim();
}

export function coerceWorkspaceTruthValue(key: string, value: unknown): unknown {
  if (BOOLEAN_KEYS.has(key)) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1"].includes(normalized)) return true;
      if (["false", "no", "0"].includes(normalized)) return false;
    }
    throw new Error(`${key} must be confirmed as Yes or No.`);
  }

  if (NUMBER_KEYS.has(key)) {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`${key} must be a positive numeric value.`);
    }
    return numeric;
  }

  if (ARRAY_KEYS.has(key)) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,\n]/)
        : [];
    const items = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (key === "ingredients" && items.length === 0) {
      throw new Error("ingredients requires at least one verified visible ingredient for product production.");
    }
    return [...new Set(items)];
  }

  if (key === "approvedProductVisual") {
    const source = normalizedString(value, key);
    if (!WORKSPACE_PRODUCT_VISUAL_SOURCES.includes(source as WorkspaceProductVisualSource)) {
      throw new Error(
        "approvedProductVisual must be APPROVED_REAL_PRODUCT_PHOTO or AI_GENERATION_ALLOWED.",
      );
    }
    return source;
  }

  if (typeof value === "string") return value.trim();
  return value;
}

export function coerceWorkspaceTruthAnswers(
  questionnaire: TaskTruthQuestionnaire,
  answers: TaskTruthAnswer[],
): TaskTruthAnswer[] {
  const byLabel = new Map(questionnaire.questions.map((question) => [question.label, question]));
  return answers.map((answer) => {
    if (answer.action === "CONFIRM" || answer.value === undefined) return answer;
    const question = byLabel.get(answer.label);
    if (!question) throw new Error(`Unexpected task truth answer: ${answer.label}.`);
    return {
      ...answer,
      value: coerceWorkspaceTruthValue(question.requirement.key, answer.value),
    };
  });
}

export function taskSnapshotFact(snapshot: TaskTruthSnapshot, key: string): unknown {
  return snapshot.facts.find((fact) => fact.key === key)?.value;
}

function taskStringArray(snapshot: TaskTruthSnapshot, key: string): string[] {
  const value = taskSnapshotFact(snapshot, key);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function assertWorkspaceProductionTruth(input: {
  snapshot: TaskTruthSnapshot;
  campaignType: string;
  uploadedAsset?: WorkspaceUploadedAsset;
}): void {
  if (input.campaignType !== "PRODUCT_PUSH") return;
  if (taskSnapshotFact(input.snapshot, "branchAvailability") !== true) {
    throw new Error("This product is not confirmed as currently available at the selected branch.");
  }
  const ingredients = taskStringArray(input.snapshot, "ingredients");
  if (!ingredients.length) {
    throw new Error("Product production requires verified visible ingredients.");
  }
  const source = taskSnapshotFact(input.snapshot, "approvedProductVisual");
  if (source === "APPROVED_REAL_PRODUCT_PHOTO") {
    if (!input.uploadedAsset) {
      throw new Error("The task confirms an approved real product photo, but no governed photo asset is uploaded and bound.");
    }
    if (
      !input.uploadedAsset.approvedForAds ||
      !input.uploadedAsset.appearanceVerified ||
      !input.uploadedAsset.ingredientMatchVerified
    ) {
      throw new Error("The uploaded product photo is not fully approved for advertising/product identity use.");
    }
  } else if (source === "AI_GENERATION_ALLOWED") {
    if (input.uploadedAsset) {
      throw new Error("This task selected AI generation, but a real base photo is also bound. Choose one governed visual source.");
    }
  } else {
    throw new Error("Product visual source is not confirmed for this task.");
  }
}

export function assertWorkspaceUploadedAssetMatchesTask(input: {
  asset: WorkspaceUploadedAsset;
  campaignId: string;
  sessionId: string;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  branchId?: string;
  productId?: string;
}): void {
  const a = input.asset;
  if (a.campaignId !== input.campaignId) throw new Error("Uploaded asset campaign binding mismatch.");
  if (a.sessionId !== input.sessionId) throw new Error("Uploaded asset session binding mismatch.");
  if (a.brandId !== input.brandId) throw new Error("Uploaded asset brand binding mismatch.");
  if ((a.branchId ?? undefined) !== (input.branchId ?? undefined)) {
    throw new Error("Uploaded asset branch binding mismatch.");
  }
  if ((a.productId ?? undefined) !== (input.productId ?? undefined)) {
    throw new Error("Uploaded asset product binding mismatch.");
  }
}

export function buildWorkspaceVisualQaContext(input: {
  campaignType: string;
  snapshot: TaskTruthSnapshot;
  uploadedAsset?: WorkspaceUploadedAsset;
}): PlannedVisualQaContext {
  const productScoped = input.campaignType === "PRODUCT_PUSH";
  const productName = taskSnapshotFact(input.snapshot, "productName");
  const ingredients = taskStringArray(input.snapshot, "ingredients");
  const mustInclude = taskStringArray(input.snapshot, "mustInclude");
  const mustNotInclude = taskStringArray(input.snapshot, "mustNotInclude");
  const source = taskSnapshotFact(input.snapshot, "approvedProductVisual");

  if (input.uploadedAsset) {
    return {
      visualClass: productScoped ? "VERIFIED_PRODUCT_VISUAL" : "GENERIC_CONCEPT_VISUAL",
      rightsStatus: input.uploadedAsset.approvedForAds ? "cleared" : "blocked",
      ...(productScoped && input.uploadedAsset.productId
        ? { productId: input.uploadedAsset.productId }
        : {}),
      ...(productScoped && typeof productName === "string" ? { productName } : {}),
      ...(ingredients.length ? { verifiedVisibleIngredients: ingredients } : {}),
      ...(mustInclude.length ? { mustInclude } : {}),
      ...(mustNotInclude.length ? { mustNotInclude } : {}),
      approvedReferenceImageIds: [input.uploadedAsset.assetId],
    };
  }

  return {
    visualClass: productScoped ? "CONSTRAINED_PRODUCT_GENERATION" : "GENERIC_CONCEPT_VISUAL",
    rightsStatus: "cleared",
    ...(productScoped && typeof productName === "string" ? { productName } : {}),
    ...(ingredients.length ? { verifiedVisibleIngredients: ingredients } : {}),
    ...(mustInclude.length ? { mustInclude } : {}),
    ...(mustNotInclude.length ? { mustNotInclude } : {}),
    ...(source === "AI_GENERATION_ALLOWED" ? {} : {}),
  };
}
'''
(ROOT / 'src/dashboard/workspaceProduction.ts').write_text(workspace_module)

# Natural-language product extraction + task-scoped product visual truth.
replace_once(
    'src/ui/taskIntent.ts',
    'const promote = text.match(/(?:promote|feature)\\s+(?:our\\s+)?(.+?)(?:\\s+(?:at|in|for|on|this|tonight|across)\\b|[.!?]|$)/i)?.[1]?.trim();',
    'const promote = text.match(/(?:promote|feature|featuring)\\s+(?:our\\s+)?(.+?)(?:\\s+(?:at|in|for|on|this|tonight|across)\\b|[.!?]|$)/i)?.[1]?.trim();',
)
replace_once(
    'src/ui/taskIntent.ts',
    '''  const additionalTruthNeeded = [\n    ...(input.showPrice ? ["price"] : []),\n    ...(requestedProductClaims.length ? ["requestedProductClaims"] : []),\n    ...(input.packagingDirectionRequested ? ["approvedPackagingDirection"] : []),\n  ];''',
    '''  const additionalTruthNeeded = [\n    ...(input.campaignType === "PRODUCT_PUSH" ? ["ingredients", "mustInclude", "mustNotInclude"] : []),\n    ...(input.showPrice ? ["price"] : []),\n    ...(requestedProductClaims.length ? ["requestedProductClaims"] : []),\n    ...(input.packagingDirectionRequested ? ["approvedPackagingDirection"] : []),\n  ];''',
)

# Ensure Food Composer truth reaches Visual QA even outside calibration harnesses.
replace_once(
    'src/commands/producePlannedCampaign.ts',
    '''          foodTemplateId: input.foodComposition.templateId,\n          verifiedCookingMethods: [...input.foodComposition.confirmedCookingMethods],''',
    '''          foodTemplateId: input.foodComposition.templateId,\n          verifiedVisibleIngredients: [...input.foodComposition.confirmedIngredients],\n          verifiedCookingMethods: [...input.foodComposition.confirmedCookingMethods],''',
)

# Backend integration imports.
replace_once(
    'src/dashboard/marketingManager.ts',
    'import type { TaskTruthAnswer, TaskTruthSnapshot } from "../taskTruth.js";',
    'import type { TaskTruthAnswer, TaskTruthSnapshot } from "../taskTruth.js";\nimport {\n  WORKSPACE_PRODUCTION_PROFILE,\n  assertWorkspaceProductionTruth,\n  assertWorkspaceUploadedAssetMatchesTask,\n  buildWorkspaceVisualQaContext,\n  coerceWorkspaceTruthAnswers,\n  type WorkspaceUploadedAsset,\n} from "./workspaceProduction.js";',
)

# Coerce truth by schema before immutable task snapshot creation.
replace_once(
    'src/dashboard/marketingManager.ts',
    '''      const snapshot = answerConfirmedCampaignTask({\n        questionnaire,\n        answers: answerArray(data.answers),\n        confirmedBy: stringValue(data.confirmedBy, "confirmedBy"),\n      });''',
    '''      const snapshot = answerConfirmedCampaignTask({\n        questionnaire,\n        answers: coerceWorkspaceTruthAnswers(questionnaire, answerArray(data.answers)),\n        confirmedBy: stringValue(data.confirmedBy, "confirmedBy"),\n      });''',
)

# Bootstrap exposes the exact production profile used by the workspace.
replace_once(
    'src/dashboard/marketingManager.ts',
    '''        paidMediaAllowed: process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true",\n        storedTruthCount: truth.records.length,''',
    '''        paidMediaAllowed: process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true",\n        productionProfile: WORKSPACE_PRODUCTION_PROFILE,\n        storedTruthCount: truth.records.length,''',
)

# Governed upload now creates an asset record bound to campaign/session/brand/branch/product.
re_replace_once(
    'src/dashboard/marketingManager.ts',
    r'''    if \(req\.method === "POST" && url\.pathname === "/api/ui/upload"\) \{.*?      return true;\n    \}\n\n    if \(req\.method === "POST" && url\.pathname === "/api/ui/produce"\) \{''',
    r'''    if (req.method === "POST" && url.pathname === "/api/ui/upload") {
      const data = await readBody(req);
      const sessionId = safeId(stringValue(data.sessionId, "sessionId"), "sessionId");
      const campaignId = safeId(stringValue(data.campaignId, "campaignId"), "campaignId");
      const brandId = data.brandId === "ATTHAS_BURGER" || data.brandId === "ATTHAS_RESTAURANT"
        ? data.brandId
        : undefined;
      if (!brandId) throw new Error("A valid operating brand is required for image upload.");
      const branchId = typeof data.branchId === "string" && data.branchId.trim()
        ? safeId(data.branchId.trim(), "branchId")
        : undefined;
      const productId = typeof data.productId === "string" && data.productId.trim()
        ? data.productId.trim()
        : undefined;
      const filename = stringValue(data.filename, "filename").slice(0, 180);
      const approvedForAds = data.approvedForAds === true;
      const appearanceVerified = data.appearanceVerified === true;
      const ingredientMatchVerified = data.ingredientMatchVerified === true;
      const dataUrl = stringValue(data.dataUrl, "dataUrl");
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
      if (!match) throw new Error("Only PNG, JPEG and WebP image uploads are supported.");
      const bytes = Buffer.from(match[2]!, "base64");
      if (bytes.length < 1_000) throw new Error("Uploaded image is unexpectedly small.");
      if (bytes.length > 15 * 1024 * 1024) throw new Error("Uploaded image exceeds 15 MB limit.");
      const extension = match[1] === "image/png" ? ".png" : match[1] === "image/webp" ? ".webp" : ".jpg";
      const dir = join(rootDir, "uploads", sessionId);
      await mkdir(dir, { recursive: true });
      const assetId = safeId(`asset-${randomUUID()}`, "assetId");
      const path = join(dir, `${assetId}${extension}`);
      await writeFile(path, bytes);
      const asset: WorkspaceUploadedAsset = {
        schemaVersion: 1,
        assetId,
        sessionId,
        campaignId,
        filename,
        path,
        mimeType: match[1] as WorkspaceUploadedAsset["mimeType"],
        bytes: bytes.length,
        brandId,
        ...(branchId ? { branchId } : {}),
        ...(productId ? { productId } : {}),
        sourceType: "owner_supplied",
        approvedForAds,
        appearanceVerified,
        ingredientMatchVerified,
        createdAt: new Date().toISOString(),
      };
      await writeFile(join(dir, `${assetId}.json`), JSON.stringify(asset, null, 2), "utf8");
      sendJson(res, 201, asset);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/ui/produce") {''',
)

# Replace insecure path-from-client lookup with governed asset-id resolution and bind to task.
re_replace_once(
    'src/dashboard/marketingManager.ts',
    r'''      const mode = data\.mode === "FINAL" \? "FINAL" : "DRAFT";\n      const baseImagePath = typeof data\.baseImagePath === "string" && data\.baseImagePath\.trim\(\)\n        \? resolve\(data\.baseImagePath\.trim\(\)\)\n        : undefined;\n      if \(baseImagePath\) \{.*?      \}\n      const paidMediaAllowed = process\.env\.ALLOW_PAID_MEDIA\?\.trim\(\)\.toLowerCase\(\) === "true";''',
    r'''      const mode = data.mode === "FINAL" ? "FINAL" : "DRAFT";
      const assetId = typeof data.baseImageAssetId === "string" && data.baseImageAssetId.trim()
        ? safeId(data.baseImageAssetId.trim(), "baseImageAssetId")
        : undefined;
      let uploadedAsset: WorkspaceUploadedAsset | undefined;
      let baseImagePath: string | undefined;
      if (assetId) {
        const assetPath = join(rootDir, "uploads", sessionId, `${assetId}.json`);
        uploadedAsset = JSON.parse(await readFile(assetPath, "utf8")) as WorkspaceUploadedAsset;
        assertWorkspaceUploadedAssetMatchesTask({
          asset: uploadedAsset,
          campaignId,
          sessionId,
          brandId: normalized.intent.brandId,
          ...(normalized.intent.branchScope !== "BRAND_WIDE" ? { branchId: normalized.intent.branchScope } : {}),
          ...(normalized.intent.productId ? { productId: normalized.intent.productId } : {}),
        });
        baseImagePath = resolve(uploadedAsset.path);
        const uploadRoot = resolve(rootDir, "uploads", sessionId) + sep;
        if (!baseImagePath.startsWith(uploadRoot)) {
          throw new Error("Workspace base images must come from the governed task upload area.");
        }
        await readFile(baseImagePath);
      }
      assertWorkspaceProductionTruth({
        snapshot,
        campaignType: normalized.intent.campaignType,
        ...(uploadedAsset ? { uploadedAsset } : {}),
      });
      const paidMediaAllowed = process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true";''',
)

# Calibrated production flags and correct Visual-QA context for real vs generated imagery.
replace_once(
    'src/dashboard/marketingManager.ts',
    '''            outputDir,\n            mode,\n            providers: {''',
    '''            outputDir,\n            mode,\n            featureFlags: WORKSPACE_PRODUCTION_PROFILE,\n            providers: {''',
)
re_replace_once(
    'src/dashboard/marketingManager.ts',
    r'''            \.\.\.\(mode === "FINAL"\n              \? \{\n                  visualQaContext: \{\n                    visualClass: normalized\.intent\.campaignType === "PRODUCT_PUSH"\n                      \? "CONSTRAINED_PRODUCT_GENERATION"\n                      : "GENERIC_CONCEPT_VISUAL",\n                    rightsStatus: baseImagePath \? "unknown" : "cleared",\n                    mustNotInclude: \[\n                      "generated ATTHA'S signage",\n                      "generated menu text",\n                      "unconfirmed product ingredients or product presentation",\n                    \],\n                  \},\n                \}\n              : \{\}\),''',
    r'''            ...(mode === "FINAL"
              ? {
                  visualQaContext: (() => {
                    const context = buildWorkspaceVisualQaContext({
                      campaignType: normalized.intent.campaignType,
                      snapshot,
                      ...(uploadedAsset ? { uploadedAsset } : {}),
                    });
                    return {
                      ...context,
                      mustNotInclude: [
                        ...(context.mustNotInclude ?? []),
                        "generated ATTHA'S signage",
                        "generated menu text",
                        "unconfirmed product ingredients or product presentation",
                      ],
                    };
                  })(),
                }
              : {}),''',
)

# Final output enters INTERNAL_REVIEW automatically; human approval is still required for later states.
replace_once(
    'src/dashboard/marketingManager.ts',
    '''  for (const attempt of result.imageAttempts) {\n    if (attempt.costUsd === undefined) continue;\n    await input.workflow.addSpend({\n      spendId: randomUUID(),\n      campaignId: input.campaignId,\n      createdAt: new Date().toISOString(),\n      category: "image",\n      provider: attempt.provider,\n      model: attempt.model,\n      amountUsd: attempt.costUsd,\n      description: `Image attempt ${attempt.attempt}`,\n    });\n  }\n}''',
    '''  for (const attempt of result.imageAttempts) {\n    if (attempt.costUsd === undefined) continue;\n    await input.workflow.addSpend({\n      spendId: randomUUID(),\n      campaignId: input.campaignId,\n      createdAt: new Date().toISOString(),\n      category: "image",\n      provider: attempt.provider,\n      model: attempt.model,\n      amountUsd: attempt.costUsd,\n      description: `Image attempt ${attempt.attempt}`,\n    });\n  }\n\n  if (result.status === "FINAL_RENDERED" && campaign.state === "DRAFT") {\n    await input.workflow.transition({\n      campaignId: input.campaignId,\n      to: "INTERNAL_REVIEW",\n      actorId: "marketing-manager-workspace",\n      actorRole: "system",\n      note: "Final + QA output rendered successfully and is ready for human internal review.",\n    });\n  }\n}''',
)

# Frontend: expose calibrated profile, typed truth controls, governed upload binding, and real production status.
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    'const state={bootstrap:null,intent:null,prepared:null,snapshot:null,baseImagePath:null};',
    'const state={bootstrap:null,intent:null,prepared:null,snapshot:null,baseImageAsset:null};',
)
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''function resetDownstreamTaskState(){state.prepared=null;state.snapshot=null;state.baseImagePath=null;$('truthPanel').classList.add('hidden');$('mediaPanel').classList.add('hidden');$('resultPanel').classList.add('hidden');$('questions').innerHTML='';$('uploadStatus').classList.add('hidden');$('resultStatus').textContent='';$('concepts').innerHTML='';$('posterArea').classList.add('hidden');$('resultJson').classList.add('hidden');$('imageFile').value='';setStep(1)}''',
    '''function resetDownstreamTaskState(){state.prepared=null;state.snapshot=null;state.baseImageAsset=null;$('truthPanel').classList.add('hidden');$('mediaPanel').classList.add('hidden');$('resultPanel').classList.add('hidden');$('questions').innerHTML='';$('uploadStatus').classList.add('hidden');$('resultStatus').textContent='';$('concepts').innerHTML='';$('posterArea').classList.add('hidden');$('resultJson').classList.add('hidden');$('imageFile').value='';setStep(1)}''',
)
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''$('prepare').onclick=async()=>{try{state.snapshot=null;state.baseImagePath=null;$('mediaPanel').classList.add('hidden');$('resultPanel').classList.add('hidden');state.intent=syncIntent();''',
    '''$('prepare').onclick=async()=>{try{state.snapshot=null;state.baseImageAsset=null;$('mediaPanel').classList.add('hidden');$('resultPanel').classList.add('hidden');state.intent=syncIntent();''',
)

# Rich question renderer and typed answer conversion.
re_replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    r'''function renderQuestions\(qs\)\{.*?\}\nfunction answersFromUi\(\)\{.*?\}\nasync function loadBootstrap''',
    r'''function truthControl(q,idx,val){const key=q.requirement.key;if(key==='branchAvailability'){const n=String(val).toLowerCase();return '<select data-q="'+idx+'"><option value="">Select</option><option value="true"'+(n==='true'||n==='yes'?' selected':'')+'>Yes — currently available</option><option value="false"'+(n==='false'||n==='no'?' selected':'')+'>No — not currently available</option></select>'}if(key==='approvedProductVisual'){return '<select data-q="'+idx+'"><option value="">Select governed source</option><option value="APPROVED_REAL_PRODUCT_PHOTO"'+(val==='APPROVED_REAL_PRODUCT_PHOTO'?' selected':'')+'>Approved real product photo</option><option value="AI_GENERATION_ALLOWED"'+(val==='AI_GENERATION_ALLOWED'?' selected':'')+'>Allow constrained AI generation</option></select>'}if(key==='price'){return '<input type="number" min="1" step="1" data-q="'+idx+'" value="'+esc(val)+'" placeholder="Enter LKR amount">'}if(['ingredients','mustInclude','mustNotInclude','cookingMethods'].includes(key)){return '<input type="text" data-q="'+idx+'" value="'+esc(Array.isArray(val)?val.join(', '):val)+'" placeholder="Comma-separated'+(key==='ingredients'?' verified items':' values; leave blank if none')+'">'}return '<input type="text" data-q="'+idx+'" value="'+esc(val)+'" placeholder="Enter current value">'}
function renderQuestions(qs){const root=$('questions');root.innerHTML='';if(!qs.length){root.innerHTML='<div class="empty">This task has no customer-facing operational facts to confirm. You can continue.</div>';return}qs.forEach((q,idx)=>{const d=document.createElement('div');d.className='q';const val=q.storedValue===undefined?(q.suggestedValue===undefined?'':q.suggestedValue):q.storedValue;d.innerHTML='<div class="qhead"><strong>'+esc(q.requirement.key)+'</strong><span class="qkind">'+esc(q.kind)+'</span></div><p>'+esc(q.prompt)+'</p><div class="scope">'+esc([q.scope.branchId,q.scope.productId,q.scope.salesChannel].filter(Boolean).join(' · ')||'brand-wide')+'</div>'+truthControl(q,idx,val)+'<label class="save"><input type="checkbox" data-save="'+idx+'"> Save a changed/new value to truth memory</label>';root.appendChild(d)})}
function typedAnswerValue(q,input){const raw=input?.value??'';if(q.requirement.key==='branchAvailability'){if(raw==='true')return true;if(raw==='false')return false;return raw}if(q.requirement.key==='price')return raw===''?'':Number(raw);if(['ingredients','mustInclude','mustNotInclude','cookingMethods'].includes(q.requirement.key))return raw.split(',').map(x=>x.trim()).filter(Boolean);return raw}
function answersFromUi(){return state.prepared.questionnaire.questions.map((q,idx)=>{const input=document.querySelector('[data-q="'+idx+'"]');const save=document.querySelector('[data-save="'+idx+'"]');const value=typedAnswerValue(q,input);if(q.kind==='CONFIRM_STORED'&&JSON.stringify(value)===JSON.stringify(q.storedValue))return{label:q.label,action:'CONFIRM',updateStoredTruth:false};return{label:q.label,action:q.kind==='CONFIRM_STORED'?'REPLACE':'PROVIDE',value,updateStoredTruth:!!save?.checked}})}
async function loadBootstrap''',
)

# Add explicit upload approval controls.
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''    <input type="file" id="imageFile" accept="image/png,image/jpeg,image/webp">\n    <div class="actions"><button id="upload" class="btn ghost">Upload selected image</button></div>''',
    '''    <input type="file" id="imageFile" accept="image/png,image/jpeg,image/webp">\n    <div class="checks" id="imageApprovalChecks">\n      <label><input type="checkbox" id="approvedForAds"> I confirm this image is approved for advertising</label>\n      <label><input type="checkbox" id="appearanceVerified"> I confirm it depicts the selected product/scene accurately</label>\n      <label><input type="checkbox" id="ingredientMatchVerified"> I confirm visible product ingredients match the verified product truth</label>\n    </div>\n    <div class="actions"><button id="upload" class="btn ghost">Upload and bind selected image</button></div>''',
)

# Upload stores an asset object; file changes invalidate the old binding.
re_replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    r'''\$\('upload'\)\.onclick=async\(\)=>\{.*?\};\n\$\('produce'\)\.onclick=async\(\)=>\{''',
    r'''$('imageFile').onchange=()=>{state.baseImageAsset=null;if($('imageFile').files[0])notice('uploadStatus','Selected file is not uploaded yet. Click “Upload and bind selected image” before producing with this photo.','')};
$('upload').onclick=async()=>{try{if(!state.snapshot)throw new Error('Confirm task facts first.');const f=$('imageFile').files[0];if(!f)throw new Error('Choose an image first.');const dataUrl=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)});const current=syncIntent();const d=await api('/api/ui/upload',{method:'POST',body:JSON.stringify({sessionId:state.prepared.sessionId,campaignId:state.prepared.campaignId,brandId:current.brandId,branchId:current.branchScope==='BRAND_WIDE'?undefined:current.branchScope,productId:current.productId,filename:f.name,dataUrl,approvedForAds:$('approvedForAds').checked,appearanceVerified:$('appearanceVerified').checked,ingredientMatchVerified:$('ingredientMatchVerified').checked})});state.baseImageAsset=d;notice('uploadStatus','Bound '+d.filename+' as '+d.assetId+' to this campaign/product.','good')}catch(e){state.baseImageAsset=null;notice('uploadStatus',e.message,'bad')}};
$('produce').onclick=async()=>{''',
)
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''taskTruthSnapshot:state.snapshot,baseImagePath:state.baseImagePath,mode:$('mode').value''',
    '''taskTruthSnapshot:state.snapshot,baseImageAssetId:state.baseImageAsset?.assetId,mode:$('mode').value''',
)
# Prevent accidental AI fallback when a file is merely selected.
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''if(!state.snapshot)throw new Error('Confirm task facts first.');btn.disabled=true;''',
    '''if(!state.snapshot)throw new Error('Confirm task facts first.');if($('imageFile').files[0]&&!state.baseImageAsset)throw new Error('The selected image is not uploaded/bound yet. Upload it or clear the file picker before producing.');btn.disabled=true;''',
)

# Reveal calibrated profile in bootstrap badge.
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    '''$('truthStatus').textContent=state.bootstrap.storedTruthCount+' stored facts';$('truthStatus').className='pill ok';''',
    '''$('truthStatus').textContent=state.bootstrap.storedTruthCount+' stored facts · M2/M3 production';$('truthStatus').className='pill ok';''',
)

# Show the actual production status + QA reason even when there is no poster URL.
re_replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    r'''function renderResult\(d\)\{.*?\}\nasync function loadTrace''',
    r'''function renderResult(d){$('concepts').innerHTML='';$('posterArea').classList.add('hidden');$('resultJson').classList.add('hidden');const production=d.status==='TASK_CONFIRMED_AND_PRODUCED'?d.production:null;$('resultStatus').textContent=production?production.status:d.status;const campaign=production&&'campaign'in production?production.campaign:null;if(campaign?.creative?.concepts){campaign.creative.concepts.forEach(c=>{const el=document.createElement('div');el.className='concept '+(c.id===campaign.creative.recommendedConceptId?'win':'');el.innerHTML='<h4>'+esc(c.campaignName)+'</h4><div>'+esc(c.coreIdea)+'</div><p><b>'+esc(c.headlineDirection)+'</b></p><small>'+esc(c.cta)+'</small>'; $('concepts').appendChild(el)})}if(d.posterUrl){$('poster').src=d.posterUrl+'?t='+Date.now();$('posterArea').classList.remove('hidden');const m=$('posterMeta');m.innerHTML='<div><b>Campaign</b><br>'+esc(state.prepared.campaignId)+'</div><div><b>Truth snapshot</b><br>'+esc(state.snapshot.sessionId)+'</div><div><b>Status</b><br>'+esc(production?.status)+'</div><div><b>Selected concept</b><br>'+esc(campaign?.creative?.recommendedConceptId||'—')+'</div>'}if(!d.posterUrl){const detail={taskStatus:d.status,productionStatus:production?.status,visualQa:production?.visualQa?{decision:production.visualQa.decision,issues:production.visualQa.issues,notes:production.visualQa.notes}:undefined,missingTruth:production?.missingTruth,traceAvailable:d.traceAvailable};$('resultJson').textContent=JSON.stringify(detail,null,2);$('resultJson').classList.remove('hidden')}}
async function loadTrace''',
)

# Startup logs should state calibrated profile rather than silently relying on legacy env flags.
replace_once(
    'scripts/serve-atthas-marketing-manager.ts',
    '''  console.log(`AI image spend: ${process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true" ? "allowed" : "off"}`);''',
    '''  console.log(`AI image spend: ${process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true" ? "allowed" : "off"}`);\n  console.log("Production profile: calibrated M2/M3 (structured brief + food composer + M3 renderer)");''',
)

# Regression coverage.
tests = r'''import test from "node:test";
import assert from "node:assert/strict";

import { interpretAtthasTaskRequest, normalizeAtthasTaskIntent } from "../src/ui/taskIntent.js";
import {
  WORKSPACE_PRODUCTION_PROFILE,
  assertWorkspaceProductionTruth,
  assertWorkspaceUploadedAssetMatchesTask,
  buildWorkspaceVisualQaContext,
  coerceWorkspaceTruthValue,
  type WorkspaceUploadedAsset,
} from "../src/dashboard/workspaceProduction.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function snapshot(values: Record<string, unknown>): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "task-1",
    campaignId: "C1",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    confirmedBy: "owner",
    confirmedAt: "2026-08-28T00:00:00.000Z",
    facts: Object.entries(values).map(([key, value]) => ({
      label: key,
      key,
      value,
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", branchId: "BURGER_WELLAMPITIYA", productId: "Crispy Chicken Burger" },
      confirmationAction: "PROVIDE",
      updateStoredTruthRequested: false,
    })),
  };
}

const asset: WorkspaceUploadedAsset = {
  schemaVersion: 1,
  assetId: "asset-1",
  sessionId: "task-1",
  campaignId: "C1",
  filename: "burger.jpg",
  path: "/tmp/burger.jpg",
  mimeType: "image/jpeg",
  bytes: 10000,
  brandId: "ATTHAS_BURGER",
  branchId: "BURGER_WELLAMPITIYA",
  productId: "Crispy Chicken Burger",
  sourceType: "owner_supplied",
  approvedForAds: true,
  appearanceVerified: true,
  ingredientMatchVerified: true,
  createdAt: "2026-08-28T00:00:00.000Z",
};

test("Marketing Manager always uses the calibrated M2/M3 production profile", () => {
  assert.deepEqual(WORKSPACE_PRODUCTION_PROFILE, {
    useStructuredBrief: true,
    useFoodComposer: true,
    useNewRenderer: true,
  });
});

test("natural-language featuring product is extracted without manual repetition", () => {
  const intent = interpretAtthasTaskRequest("Create an Instagram product post for ATTHA'S Burger Wellampitiya featuring Crispy Chicken Burger. No offer.");
  assert.equal(intent.productId, "Crispy Chicken Burger");
  assert.equal(intent.campaignType, "PRODUCT_PUSH");
  assert.ok(!intent.missingFields.includes("productId"));
});

test("product workspace asks for visible product truth needed by generation and QA", () => {
  const normalized = normalizeAtthasTaskIntent({
    ...interpretAtthasTaskRequest("Feature Crispy Chicken Burger at ATTHA'S Burger Wellampitiya."),
    mode: "FINAL",
  });
  assert.ok(normalized.entry.requiredTruth.includes("ingredients"));
  assert.ok(normalized.entry.requiredTruth.includes("mustInclude"));
  assert.ok(normalized.entry.requiredTruth.includes("mustNotInclude"));
});

test("workspace truth values are typed instead of frozen as arbitrary strings", () => {
  assert.equal(coerceWorkspaceTruthValue("branchAvailability", "yes"), true);
  assert.equal(coerceWorkspaceTruthValue("branchAvailability", "no"), false);
  assert.equal(coerceWorkspaceTruthValue("price", "1,230"), 1230);
  assert.deepEqual(coerceWorkspaceTruthValue("ingredients", "bun, chicken, lettuce"), ["bun", "chicken", "lettuce"]);
  assert.throws(() => coerceWorkspaceTruthValue("approvedProductVisual", "yes"));
});

test("real product photo must be an approved bound asset", () => {
  const s = snapshot({
    productName: "Crispy Chicken Burger",
    branchAvailability: true,
    approvedProductVisual: "APPROVED_REAL_PRODUCT_PHOTO",
    ingredients: ["bun", "crispy chicken", "cheese", "tomato", "lettuce", "sauce"],
    mustInclude: [],
    mustNotInclude: [],
  });
  assert.throws(() => assertWorkspaceProductionTruth({ snapshot: s, campaignType: "PRODUCT_PUSH" }), /no governed photo asset/i);
  assert.doesNotThrow(() => assertWorkspaceProductionTruth({ snapshot: s, campaignType: "PRODUCT_PUSH", uploadedAsset: asset }));
});

test("real uploaded product photo becomes VERIFIED_PRODUCT_VISUAL with cleared deterministic rights", () => {
  const s = snapshot({
    productName: "Crispy Chicken Burger",
    branchAvailability: true,
    approvedProductVisual: "APPROVED_REAL_PRODUCT_PHOTO",
    ingredients: ["bun", "crispy chicken", "cheese", "tomato", "lettuce", "sauce"],
    mustInclude: ["crispy chicken"],
    mustNotInclude: ["pickles"],
  });
  const context = buildWorkspaceVisualQaContext({ campaignType: "PRODUCT_PUSH", snapshot: s, uploadedAsset: asset });
  assert.equal(context.visualClass, "VERIFIED_PRODUCT_VISUAL");
  assert.equal(context.rightsStatus, "cleared");
  assert.deepEqual(context.approvedReferenceImageIds, ["asset-1"]);
  assert.deepEqual(context.verifiedVisibleIngredients, ["bun", "crispy chicken", "cheese", "tomato", "lettuce", "sauce"]);
});

test("uploaded asset cannot cross campaign/product scope", () => {
  assert.doesNotThrow(() => assertWorkspaceUploadedAssetMatchesTask({
    asset,
    campaignId: "C1",
    sessionId: "task-1",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "Crispy Chicken Burger",
  }));
  assert.throws(() => assertWorkspaceUploadedAssetMatchesTask({
    asset,
    campaignId: "C1",
    sessionId: "task-1",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "Different Burger",
  }), /product binding mismatch/i);
});
'''
(ROOT / 'tests/productionIntegrationHardening.test.ts').write_text(tests)

# Documentation checkpoint.
doc = r'''# ATTHA'S Production Integration Hardening

This hardening closes the gap between the calibrated M2/M3 engine and the Marketing Manager workspace before the 20–30 real-campaign validation.

## Production profile

The workspace now invokes the calibrated production path directly:

- structured image brief: enabled
- deterministic Food Composer: enabled
- M3 renderer: enabled
- FINAL mode: Visual QA + Final Art QA remain mandatory

The operator no longer has to remember rollout environment flags for the workspace.

## Product visual paths

A PRODUCT_PUSH task must explicitly choose one governed source:

1. `APPROVED_REAL_PRODUCT_PHOTO`
   - the actual image must be uploaded and bound to the same campaign/session/brand/branch/product
   - advertising approval, appearance accuracy and ingredient-match confirmation are recorded on the upload asset
   - Visual QA receives `VERIFIED_PRODUCT_VISUAL` and deterministic rights status

2. `AI_GENERATION_ALLOWED`
   - no real base image is bound
   - verified visible ingredients are mandatory
   - must-include / must-not-include arrays are confirmed for the task
   - the calibrated structured-brief/Food-Composer/image-tier path is used

## UI safety

- branch availability is a typed Yes/No value
- price is numeric
- ingredient and include/exclude facts are arrays
- selecting a new file invalidates an older upload binding
- Produce refuses to silently fall back to AI when a file is selected but not uploaded
- the result view displays the inner production status and QA reason when no poster is rendered

## Operations

A successful FINAL render moves the persisted campaign from `DRAFT` to `INTERNAL_REVIEW`; human/client approval is still required before later lifecycle states.

## Validation rule

The 20–30 real ATTHA'S campaign validation should restart from Campaign 01 only after this branch passes normal PR CI and is merged to `main`.
'''
(ROOT / 'docs/ATTHAS_PRODUCTION_INTEGRATION_HARDENING.md').write_text(doc)

print('Production integration hardening patch applied.')

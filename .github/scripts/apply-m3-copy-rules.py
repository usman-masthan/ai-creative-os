from pathlib import Path

# GenerateCampaignRequest carries planner campaign type when available.
p = Path('src/commands/generateCampaign.ts')
t = p.read_text()
anchor = 'import { formatLkr } from "../money.js";\n'
addition = 'import type { MarketingCampaignType } from "../marketingPlannerTypes.js";\n'
assert anchor in t and addition not in t
t = t.replace(anchor, anchor + addition, 1)
old = '''export interface GenerateCampaignRequest extends CreateCampaignRequest {
  brandContext: string;
  brandGovernance?: BrandGovernance;
'''
new = '''export interface GenerateCampaignRequest extends CreateCampaignRequest {
  brandContext: string;
  campaignType?: MarketingCampaignType;
  brandGovernance?: BrandGovernance;
'''
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)

# Planned production passes its deterministic campaign type into generation/finalization context.
p = Path('src/commands/producePlannedCampaign.ts')
t = p.read_text()
old = '''    assetType: entry.assetType,
    requirements: requirementsFromEntry(entry, request.requirementScopes),
'''
new = '''    assetType: entry.assetType,
    campaignType: entry.campaignType,
    requirements: requirementsFromEntry(entry, request.requirementScopes),
'''
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)

# Finalizer prompt receives exact M3.2 policy guidance.
p = Path('src/creativeDirectorPrompt.ts')
t = p.read_text()
anchor = 'import type { CampaignCreativeOutput, CampaignProductionFormat } from "./creativeTypes.js";\n'
addition = 'import { campaignCopyPolicyPrompt } from "./campaignCopyRules.js";\n'
assert anchor in t and addition not in t
t = t.replace(anchor, anchor + addition, 1)
old = '''- Asset type: ${request.assetType}
- Required aspect ratio: ${format.aspectRatio}

BRAND CONTEXT
'''
new = '''- Asset type: ${request.assetType}
- Campaign type: ${request.campaignType ?? "unspecified"}
- Required aspect ratio: ${format.aspectRatio}

BRAND CONTEXT
'''
assert old in t
t = t.replace(old, new, 1)
old = '''9. If a deterministic price exists in the original overlaySpec, preserve it exactly.
10. Preserve logoUsage policy; do not promote pending logo artwork.

Return ONLY a complete CampaignCreativeOutput JSON object in the same schema as ORIGINAL CREATIVE OUTPUT.`;
'''
new = '''9. If a deterministic price exists in the original overlaySpec, preserve it exactly.
10. Preserve logoUsage policy; do not promote pending logo artwork.

${campaignCopyPolicyPrompt({ campaignType: request.campaignType, brandId: request.brandId })}

Return ONLY a complete CampaignCreativeOutput JSON object in the same schema as ORIGINAL CREATIVE OUTPUT.`;
'''
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)

# Trace records which copy policy was enforced.
p = Path('src/creativeDirectorTypes.ts')
t = p.read_text()
anchor = 'export interface CreativeDirectorScores {\n'
addition = 'import type { CampaignCopyPolicyId } from "./campaignCopyRules.js";\n\n'
assert anchor in t and addition not in t
t = t.replace(anchor, addition + anchor, 1)
old = '''  finalization: {
    attempts: number;
    repairs: number;
  };
}
'''
new = '''  finalization: {
    attempts: number;
    repairs: number;
    copyPolicy?: CampaignCopyPolicyId;
  };
}
'''
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)

# Finalizer output is deterministically governed and repaired through existing bounded loop.
p = Path('src/commands/directCampaign.ts')
t = p.read_text()
anchor = 'import { assertCreativeRespectsClaimGovernance } from "../claimGovernance.js";\n'
addition = '''import {
  assertCampaignTypeCopyRules,
  type CampaignCopyPolicyId,
} from "../campaignCopyRules.js";
'''
assert anchor in t and addition not in t
t = t.replace(anchor, anchor + addition, 1)
old = '''): void {
  if (!conceptsMatch(original, creative)) {
'''
new = '''): CampaignCopyPolicyId | undefined {
  if (!conceptsMatch(original, creative)) {
'''
assert old in t
t = t.replace(old, new, 1)
old = '''  assertCreativeRespectsBrandGovernance(creative, request.brandGovernance);
}
'''
new = '''  assertCreativeRespectsBrandGovernance(creative, request.brandGovernance);
  return assertCampaignTypeCopyRules(creative, {
    campaignType: request.campaignType,
    brandId: request.brandId,
    facts: campaign.preflight.facts,
  });
}
'''
assert old in t
t = t.replace(old, new, 1)
old = '''): Promise<{ creative: CampaignCreativeOutput; attempts: number; repairs: number }> {
'''
new = '''): Promise<{
  creative: CampaignCreativeOutput;
  attempts: number;
  repairs: number;
  copyPolicy?: CampaignCopyPolicyId;
}> {
'''
assert old in t
t = t.replace(old, new, 1)
old = '''      const creative = parseCampaignCreativeOutput(raw);
      assertDirectedCreative(creative, input.campaign.creative, review, input.campaign, input.request);
      return { creative, attempts, repairs };
'''
new = '''      const creative = parseCampaignCreativeOutput(raw);
      const copyPolicy = assertDirectedCreative(
        creative,
        input.campaign.creative,
        review,
        input.campaign,
        input.request,
      );
      return { creative, attempts, repairs, ...(copyPolicy ? { copyPolicy } : {}) };
'''
assert old in t
t = t.replace(old, new, 1)
old = '''      finalization: {
        attempts: finalization.attempts,
        repairs: finalization.repairs,
      },
'''
new = '''      finalization: {
        attempts: finalization.attempts,
        repairs: finalization.repairs,
        ...(finalization.copyPolicy ? { copyPolicy: finalization.copyPolicy } : {}),
      },
'''
assert old in t
t = t.replace(old, new, 1)
p.write_text(t)

# Integration regression: invalid M3.2 final copy is repaired before downstream production.
p = Path('tests/creativeDirector.test.ts')
t = p.read_text()
marker = 'test("M3.2 PRODUCT_PUSH finalizer repairs generic copy before production"'
if marker not in t:
    t += r'''

test("M3.2 PRODUCT_PUSH finalizer repairs generic copy before production", async () => {
  const campaign = await generatedCampaign();
  const typedRequest = request();
  typedRequest.campaignType = "PRODUCT_PUSH";

  const bad = structuredClone(campaign.creative);
  bad.recommendedConceptId = "C2";
  bad.recommendationReason = "C2 selected.";
  bad.creativeBrief.headline = "Passion for flavour";
  bad.overlaySpec.headline = "Passion for flavour";

  const good = structuredClone(campaign.creative);
  good.recommendedConceptId = "C2";
  good.recommendationReason = "C2 selected with a product-specific conversion route.";
  good.creativeBrief.headline = "Crispy Chicken Burger";
  good.overlaySpec.headline = "Crispy Chicken Burger";
  good.creativeBrief.cta = "Order Now";
  good.overlaySpec.cta = "Order Now";

  const directed = await directGeneratedCampaign(
    {
      request: typedRequest,
      campaign,
      maxFinalizerRepairAttempts: 1,
    },
    {
      director: provider("creative-director", [directorReview()]),
      finalizer: provider("finalizer", [bad, good]),
    },
  );

  assert.equal(directed.creativeDirector.finalization.attempts, 2);
  assert.equal(directed.creativeDirector.finalization.repairs, 1);
  assert.equal(directed.creativeDirector.finalization.copyPolicy, "PRODUCT_PUSH");
  assert.equal(directed.creative.overlaySpec.headline, "Crispy Chicken Burger");
  assert.equal(directed.creative.overlaySpec.cta, "Order Now");
});
'''.replace('\\n', '\n')
p.write_text(t)

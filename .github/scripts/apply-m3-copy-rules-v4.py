from pathlib import Path

# exactOptionalPropertyTypes-safe context signatures
p = Path('src/campaignCopyRules.ts')
t = p.read_text()
old = 'campaignType?: MarketingCampaignType;'
assert t.count(old) == 2
p.write_text(t.replace(old, 'campaignType: MarketingCampaignType | undefined;'))

# Preserve the intent of structured-brief governance tests while making their
# final campaign copy valid under M3.2 BRAND_BUILDING rules.
p = Path('tests/structuredBriefProductionGate.test.ts')
t = p.read_text()
old = '''function invalidFinalCreative(): CampaignCreativeOutput {
  const value = structuredClone(baseCreative());
  value.creativeBrief.composition =
    "Keep the focal subject centre-right with a red rectangle and CTA box in the upper-left.";
  return value;
}
'''
new = '''function invalidFinalCreative(): CampaignCreativeOutput {
  const value = structuredClone(baseCreative());
  value.creativeBrief.cta = "Discover ATTHA'S";
  value.overlaySpec.cta = "Discover ATTHA'S";
  value.creativeBrief.composition =
    "Keep the focal subject centre-right with a red rectangle and CTA box in the upper-left.";
  return value;
}
'''
assert old in t
p.write_text(t.replace(old, new, 1))

# Apply the main wiring patch.
exec(Path('.github/scripts/apply-m3-copy-rules.py').read_text(), {})

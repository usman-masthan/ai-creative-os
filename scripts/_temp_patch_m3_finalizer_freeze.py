from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected one anchor in {path}, found {text.count(old)}")
    p.write_text(text.replace(old, new, 1))

replace_once(
    "src/commands/directCampaign.ts",
    '''      const creative = parseCampaignCreativeOutput(raw);\n      const copyPolicy = assertDirectedCreative(\n        creative,\n''',
    '''      const parsed = parseCampaignCreativeOutput(raw);\n      // The three strategist concepts are immutable source material. The finalizer may\n      // rewrite production copy/brief fields, but concept edits are discarded\n      // deterministically instead of spending repair attempts asking the model to\n      // reproduce an already-known immutable array byte-for-byte.\n      const creative: CampaignCreativeOutput = {\n        ...parsed,\n        concepts: structuredClone(input.campaign.creative.concepts),\n      };\n      const copyPolicy = assertDirectedCreative(\n        creative,\n''',
)

replace_once(
    "tests/creativeDirector.test.ts",
    '''test("Creative Director repairs a finalizer that tries to mutate the three source concepts", async () => {\n  const campaign = await generatedCampaign();\n  const bad = structuredClone(campaign.creative);\n  bad.recommendedConceptId = "C2";\n  bad.concepts[0]!.campaignName = "Mutated concept";\n\n  const good = structuredClone(campaign.creative);\n  good.recommendedConceptId = "C2";\n  good.recommendationReason = "C2 selected after structured Creative Director review.";\n\n  const directed = await directGeneratedCampaign(\n    { request: request(), campaign, maxFinalizerRepairAttempts: 1 },\n    {\n      director: provider("creative-director", [directorReview()]),\n      finalizer: provider("finalizer", [bad, good]),\n    },\n  );\n\n  assert.equal(directed.creativeDirector.finalization.attempts, 2);\n  assert.equal(directed.creativeDirector.finalization.repairs, 1);\n  assert.deepEqual(directed.creative.concepts, campaign.creative.concepts);\n});\n''',
    '''test("Creative Director deterministically freezes source concepts instead of spending a repair on model drift", async () => {\n  const campaign = await generatedCampaign();\n  const drifted = structuredClone(campaign.creative);\n  drifted.recommendedConceptId = "C2";\n  drifted.recommendationReason = "C2 selected after structured Creative Director review.";\n  drifted.concepts[0]!.campaignName = "Mutated concept";\n  drifted.concepts[2]!.risks = ["Model invented a replacement internal risk."];\n\n  const directed = await directGeneratedCampaign(\n    { request: request(), campaign, maxFinalizerRepairAttempts: 1 },\n    {\n      director: provider("creative-director", [directorReview()]),\n      finalizer: provider("finalizer", [drifted]),\n    },\n  );\n\n  assert.equal(directed.creativeDirector.finalization.attempts, 1);\n  assert.equal(directed.creativeDirector.finalization.repairs, 0);\n  assert.deepEqual(directed.creative.concepts, campaign.creative.concepts);\n});\n''',
)

print("deterministic finalizer concept freeze patch applied")

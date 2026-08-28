from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/structuredImageBrief.ts",
    '''      "No specific verified SKU supplied",\n    physicalState:\n      input.subject?.physicalState?.trim() ||\n      "physically plausible food subject matching only the verified product identity; do not infer preparation method",''',
    '''      "Generic concept visual — no verified product identity",\n    physicalState:\n      input.subject?.physicalState?.trim() ||\n      "physically plausible generic concept subject; do not imply a specific menu item, preparation method or product identity",''',
)
replace_once(
    "src/structuredImageBrief.ts",
    '''      "show only directly visible surface texture; do not imply freshness, juiciness, premium quality or cooking method",''',
    '''      "show only neutral, directly visible material texture; do not infer unverified condition, temperature, moisture, preparation or sensory attributes",''',
)

replace_once(
    "src/layouts/atthas.ts",
    '''    if (offerLanguage) return getLayout("ATTHAS_BURGER_OFFER_DEAL_V1");\n    if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_BURGER_PROMOTIONAL_PRICE_V1");\n    if (role === "brand-building") return getLayout("ATTHAS_BURGER_MINIMAL_PREMIUM_V1");''',
    '''    if (offerLanguage) return getLayout("ATTHAS_BURGER_OFFER_DEAL_V1");\n    if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_BURGER_PROMOTIONAL_PRICE_V1");\n    if (input.campaignType === "BRAND_BUILDING" || role === "brand-building") {\n      return getLayout("ATTHAS_BURGER_MINIMAL_PREMIUM_V1");\n    }''',
)

replace_once(
    "src/visualQa/gemini.ts",
    '''    "GENERIC_CONCEPT_VISUAL cannot PASS as an actual product advertisement. It must be HUMAN_REVIEW or BLOCK even when aesthetically strong.",''',
    '''    "GENERIC_CONCEPT_VISUAL may PASS for brand-building or hospitality concept imagery when no product ID/name is supplied, the pixels do not represent the scene as an actual ATTHA'S menu item, and every other QA dimension passes.",\n    "For non-product GENERIC_CONCEPT_VISUAL, productTruth measures whether the scene remains generic and avoids claiming a specific menu item. Do not penalize it merely because recipe mapping or product-reference photography is absent.",\n    "GENERIC_CONCEPT_VISUAL with a supplied product ID/name cannot PASS as an actual product visual. It must be HUMAN_REVIEW or BLOCK even when aesthetically strong.",''',
)
replace_once(
    "src/visualQa/gemini.ts",
    '''  if (request.visualClass === "GENERIC_CONCEPT_VISUAL" && decision === "PASS") {\n    decision = "HUMAN_REVIEW";\n    issues.push("Generic concept imagery cannot pass as verified product advertising.");\n  }\n\n  const evidenceText = [''',
    '''  const productScoped = Boolean(request.productId || request.productName);\n  if (\n    request.visualClass === "GENERIC_CONCEPT_VISUAL" &&\n    productScoped &&\n    decision === "PASS"\n  ) {\n    decision = "HUMAN_REVIEW";\n    issues.push("Generic concept imagery cannot pass as verified product advertising.");\n  }\n\n  const evidenceText = [''',
)
replace_once(
    "src/visualQa/gemini.ts",
    '''  const productScoped = Boolean(request.productId || request.productName);\n  if (\n    productScoped &&\n    request.visualClass !== "GENERIC_CONCEPT_VISUAL" &&''',
    '''  if (\n    productScoped &&\n    request.visualClass !== "GENERIC_CONCEPT_VISUAL" &&''',
)

p = Path("tests/atthasLayouts.test.ts")
text = p.read_text()
anchor = '''test("Restaurant shared-table language selects multi-dish layout", () => {'''
addition = '''test("Burger BRAND_BUILDING campaign type selects minimal-premium even when AI role drifts", () => {\n  const value = creative();\n  assert.equal(\n    selectAtthasLayout({\n      brandId: "ATTHAS_BURGER",\n      creative: value,\n      format: squareish,\n      campaignType: "BRAND_BUILDING",\n    }).id,\n    "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",\n  );\n});\n\n'''
if addition not in text:
    if anchor not in text:
        raise SystemExit("atthasLayouts test anchor not found")
    p.write_text(text.replace(anchor, addition + anchor, 1))

p = Path("tests/geminiVisualQa.test.ts")
text = p.read_text()
old = '''  // Generic concept imagery cannot PASS; the composition failure must still be surfaced.\n  assert.notEqual(result.decision, "PASS");\n  assert.ok(result.issues.some((issue) => issue.includes("Generic concept imagery")));\n});'''
new = '''  assert.equal(result.decision, "REGENERATE");\n  assert.ok(result.issues.some((issue) => issue.includes("copy-safe zones")));\n});'''
if old not in text:
    raise SystemExit("generic poor-zone test anchor not found")
text = text.replace(old, new, 1)
anchor = '''test("generic concept imagery cannot deterministically PASS as an actual product visual", async () => {'''
addition = '''test("non-product generic concept imagery may PASS brand or hospitality QA", async () => {\n  const provider = new GeminiVisualQaProvider({\n    apiKey: "gemini-test-key",\n    fetchImpl: async () => visualQaResponse("PASS"),\n  });\n\n  const result = await provider.review({\n    imageBase64: "ZmFrZQ==",\n    mimeType: "image/jpeg",\n    brandId: "ATTHAS_RESTAURANT",\n    visualClass: "GENERIC_CONCEPT_VISUAL",\n    rightsStatus: "cleared",\n  });\n\n  assert.equal(result.decision, "PASS");\n  assert.ok(!result.issues.some((issue) => issue.includes("Generic concept imagery")));\n});\n\n'''
if addition not in text:
    if anchor not in text:
        raise SystemExit("generic product-scope test anchor not found")
    text = text.replace(anchor, addition + anchor, 1)
p.write_text(text)

p = Path("tests/structuredBriefGovernance.test.ts")
text = p.read_text()
anchor = '''test("structured brief governance rejects renderer-style graphic design language", () => {'''
addition = '''test("generic no-product structured brief fallback is lexical-claim safe", () => {\n  const genericPreflight: CampaignPreflight = {\n    status: "READY_FOR_CREATIVE",\n    factGate: "PASS",\n    missing: [],\n    conflicts: [],\n    facts: [],\n    riskLevel: "low",\n    humanApprovalRequired: false,\n  };\n  const brief = buildStructuredImageBrief({\n    campaignId: "M3-GENERIC-CONCEPT",\n    brandId: "ATTHAS_BURGER",\n    creative: creative(),\n    format,\n    layout,\n    verifiedFacts: [],\n  });\n  const result = validateStructuredBriefGovernance({\n    brief,\n    preflight: genericPreflight,\n    creative: creative(),\n  });\n\n  assert.equal(brief.subject.productName, "Generic concept visual — no verified product identity");\n  assert.doesNotMatch(Object.values(brief.subject).join(" "), /\\bfresh(?:ness)?\\b|\\bjuicy|\\bsteam(?:ing)?\\b/i);\n  assert.ok(!result.issues.some((issue) => issue.code === "FAIL_STRUCTURED_BRIEF_UNSUPPORTED_CLAIM"));\n});\n\n'''
if addition not in text:
    if anchor not in text:
        raise SystemExit("structured brief test anchor not found")
    p.write_text(text.replace(anchor, addition + anchor, 1))

replace_once(
    "tests/structuredBriefProductionGate.test.ts",
    'function safeRepairSubject(productName = "No specific verified SKU supplied") {',
    'function safeRepairSubject(productName = "Generic concept visual — no verified product identity") {',
)

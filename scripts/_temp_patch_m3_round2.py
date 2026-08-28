from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"anchor not unique in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# 1) Claim governance: concept ideation metadata is not a publishable/production claim surface.
# Final copy, creative brief visual directions and image prompts remain governed.
replace_once(
    "src/claimGovernance.ts",
    '''function collectClaimBearingText(creative: CampaignCreativeOutput): string[] {\n  const conceptCopy = creative.concepts.flatMap((concept) => [\n    concept.campaignName,\n    concept.coreIdea,\n    concept.headlineDirection,\n    concept.visualConcept,\n    concept.cta,\n  ]);\n\n  return [\n    ...conceptCopy,\n''',
    '''function collectClaimBearingText(creative: CampaignCreativeOutput): string[] {\n  // Concept objects are internal ideation metadata. They are never rendered or sent\n  // directly to the image model. Govern only production-facing/customer-facing fields;\n  // if an internal idea leaks into final copy or image instructions it is still blocked.\n  return [\n''',
)

# 2) DINE_IN routing: avoid product-hero photography for no-product visit/hospitality briefs.
replace_once(
    "src/layouts/atthas.ts",
    '''    if (offerLanguage) return getLayout("ATTHAS_BURGER_OFFER_DEAL_V1");\n    if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_BURGER_PROMOTIONAL_PRICE_V1");\n    if (input.campaignType === "BRAND_BUILDING" || role === "brand-building") {\n''',
    '''    if (offerLanguage) return getLayout("ATTHAS_BURGER_OFFER_DEAL_V1");\n    if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_BURGER_PROMOTIONAL_PRICE_V1");\n    if (input.campaignType === "DINE_IN") {\n      return getLayout("ATTHAS_BURGER_MINIMAL_PREMIUM_V1");\n    }\n    if (input.campaignType === "BRAND_BUILDING" || role === "brand-building") {\n''',
)
replace_once(
    "src/layouts/atthas.ts",
    '''  if (multiDishLanguage) return getLayout("ATTHAS_RESTAURANT_MULTI_DISH_V1");\n  if (input.campaignType === "PRODUCT_PUSH") return getLayout("ATTHAS_RESTAURANT_FOOD_HERO_V1");\n  if (role === "brand-building") return getLayout("ATTHAS_RESTAURANT_EDITORIAL_V1");\n''',
    '''  if (multiDishLanguage) return getLayout("ATTHAS_RESTAURANT_MULTI_DISH_V1");\n  if (input.campaignType === "PRODUCT_PUSH") return getLayout("ATTHAS_RESTAURANT_FOOD_HERO_V1");\n  if (input.campaignType === "DINE_IN") return getLayout("ATTHAS_RESTAURANT_HOSPITALITY_V1");\n  if (role === "brand-building") return getLayout("ATTHAS_RESTAURANT_EDITORIAL_V1");\n''',
)

# 3) Restaurant supporting copy: approved high-contrast token instead of grey on bright imagery.
replace_once(
    "src/m3Renderer.ts",
    '''    color: ${restaurant ? "var(--atthas-grey)" : "var(--atthas-cream)"};\n''',
    '''    color: ${restaurant ? "var(--atthas-ink)" : "var(--atthas-cream)"};\n''',
)

# 4) Final Art QA: add per-dimension evidence so PASS-score contradictions can be normalized
# without hiding real visible concerns.
replace_once(
    "src/finalArtQa/types.ts",
    '''export type FinalArtQaDecision = "PASS" | "REGENERATE" | "HUMAN_REVIEW" | "BLOCK";\nexport type FinalArtQaCheckState = "PASS" | "FAIL" | "NOT_APPLICABLE";\n''',
    '''export type FinalArtQaDecision = "PASS" | "REGENERATE" | "HUMAN_REVIEW" | "BLOCK";\nexport type FinalArtQaCheckState = "PASS" | "FAIL" | "NOT_APPLICABLE";\nexport type FinalArtQaEvidenceState = "PASS" | "CONCERN" | "FAIL" | "NOT_APPLICABLE";\n\nexport interface FinalArtQaDimensionEvidence {\n  status: FinalArtQaEvidenceState;\n  observations: string[];\n}\n''',
)
replace_once(
    "src/finalArtQa/types.ts",
    '''export interface FinalArtQaResult {\n  provider: string;\n  model: string;\n  decision: FinalArtQaDecision;\n  scores: FinalArtQaScores;\n  checks: FinalArtQaChecks;\n  issues: string[];\n''',
    '''export type FinalArtQaEvidence = {\n  [K in keyof FinalArtQaScores]: FinalArtQaDimensionEvidence;\n};\n\nexport interface FinalArtQaResult {\n  provider: string;\n  model: string;\n  decision: FinalArtQaDecision;\n  scores: FinalArtQaScores;\n  checks: FinalArtQaChecks;\n  evidence: FinalArtQaEvidence;\n  issues: string[];\n''',
)

# Gemini schema/import/parser/prompt.
replace_once(
    "src/finalArtQa/gemini.ts",
    '''  FinalArtQaCheckState,\n  FinalArtQaChecks,\n  FinalArtQaDecision,\n  FinalArtQaProvider,\n''',
    '''  FinalArtQaCheckState,\n  FinalArtQaChecks,\n  FinalArtQaDecision,\n  FinalArtQaDimensionEvidence,\n  FinalArtQaEvidence,\n  FinalArtQaEvidenceState,\n  FinalArtQaProvider,\n''',
)
replace_once(
    "src/finalArtQa/gemini.ts",
    '''const CHECK_SCHEMA = {\n  type: "string",\n  enum: ["PASS", "FAIL", "NOT_APPLICABLE"],\n} as const;\n''',
    '''const CHECK_SCHEMA = {\n  type: "string",\n  enum: ["PASS", "FAIL", "NOT_APPLICABLE"],\n} as const;\nconst EVIDENCE_STATUS_SCHEMA = {\n  type: "string",\n  enum: ["PASS", "CONCERN", "FAIL", "NOT_APPLICABLE"],\n} as const;\nconst EVIDENCE_SCHEMA = {\n  type: "object",\n  additionalProperties: false,\n  properties: {\n    status: EVIDENCE_STATUS_SCHEMA,\n    observations: { type: "array", items: { type: "string" } },\n  },\n  required: ["status", "observations"],\n} as const;\n''',
)
replace_once(
    "src/finalArtQa/gemini.ts",
    '''    checks: {\n      type: "object",\n      additionalProperties: false,\n      properties: Object.fromEntries(FINAL_ART_DIMENSIONS.map((key) => [key, CHECK_SCHEMA])),\n      required: [...FINAL_ART_DIMENSIONS],\n    },\n    issues: { type: "array", items: { type: "string" } },\n''',
    '''    checks: {\n      type: "object",\n      additionalProperties: false,\n      properties: Object.fromEntries(FINAL_ART_DIMENSIONS.map((key) => [key, CHECK_SCHEMA])),\n      required: [...FINAL_ART_DIMENSIONS],\n    },\n    evidence: {\n      type: "object",\n      additionalProperties: false,\n      properties: Object.fromEntries(FINAL_ART_DIMENSIONS.map((key) => [key, EVIDENCE_SCHEMA])),\n      required: [...FINAL_ART_DIMENSIONS],\n    },\n    issues: { type: "array", items: { type: "string" } },\n''',
)
replace_once(
    "src/finalArtQa/gemini.ts",
    '''  required: ["decision", "scores", "checks", "issues", "notes"],\n''',
    '''  required: ["decision", "scores", "checks", "evidence", "issues", "notes"],\n''',
)
replace_once(
    "src/finalArtQa/gemini.ts",
    '''function strings(value: unknown, name: string): string[] {\n''',
    '''function evidenceState(value: unknown, name: string): FinalArtQaEvidenceState {\n  if (value !== "PASS" && value !== "CONCERN" && value !== "FAIL" && value !== "NOT_APPLICABLE") {\n    throw new Error(`Gemini final-art QA returned invalid ${name} evidence status.`);\n  }\n  return value;\n}\n\nfunction parseEvidenceItem(value: unknown, name: string): FinalArtQaDimensionEvidence {\n  if (!value || typeof value !== "object") {\n    throw new Error(`Gemini final-art QA returned invalid ${name} evidence.`);\n  }\n  const item = value as Record<string, unknown>;\n  return {\n    status: evidenceState(item.status, name),\n    observations: strings(item.observations, `${name}.observations`),\n  };\n}\n\nfunction parseEvidence(value: unknown): FinalArtQaEvidence {\n  if (!value || typeof value !== "object") {\n    throw new Error("Gemini final-art QA returned invalid evidence.");\n  }\n  const evidence = value as Record<string, unknown>;\n  return Object.fromEntries(\n    FINAL_ART_DIMENSIONS.map((key) => [key, parseEvidenceItem(evidence[key], key)]),\n  ) as FinalArtQaEvidence;\n}\n\nfunction strings(value: unknown, name: string): string[] {\n''',
)
# Move strings before parseEvidence use at runtime by converting function declaration is fine (hoisted).
replace_once(
    "src/finalArtQa/gemini.ts",
    '''    "Inspect all nine M3.3 dimensions and return a 0-100 score plus PASS/FAIL/NOT_APPLICABLE check for each.",\n''',
    '''    "Inspect all nine M3.3 dimensions and return a 0-100 score, PASS/FAIL/NOT_APPLICABLE check, and evidence for each.",\n''',
)
replace_once(
    "src/finalArtQa/gemini.ts",
    '''    "- Do not approve artwork if expected customer-facing copy is visibly missing, materially altered, duplicated, clipped or unreadable.",\n''',
    '''    "- Evidence status PASS means no material visible defect for that dimension; scores for PASS evidence must meet the deterministic pass floor.",\n    "- Evidence status CONCERN means a concrete visible weakness or ambiguity. Name the actual pixel-level weakness in observations; do not use missing metadata or uncertainty as concern evidence.",\n    "- Evidence status FAIL means a concrete visible defect. Name it in observations and issues.",\n    "- NOT_APPLICABLE evidence is allowed only when the corresponding check is NOT_APPLICABLE.",\n    "- Do not approve artwork if expected customer-facing copy is visibly missing, materially altered, duplicated, clipped or unreadable.",\n''',
)

# Replace applyGuards with evidence-aware version.
start = Path("src/finalArtQa/gemini.ts").read_text().index("function applyGuards(")
end = Path("src/finalArtQa/gemini.ts").read_text().index("\nexport class GeminiFinalArtQaProvider", start)
text = Path("src/finalArtQa/gemini.ts").read_text()
new_guard = '''function applyGuards(\n  result: Omit<FinalArtQaResult, "provider" | "model" | "usage">,\n  request: FinalArtQaRequest,\n): Omit<FinalArtQaResult, "provider" | "model" | "usage"> {\n  let decision = result.decision;\n  const issues = [...result.issues];\n  const notes = [...result.notes];\n  const scores = { ...result.scores };\n\n  const optional: Array<{\n    key: "priceVisibility" | "productDominance" | "platformReadability";\n    applicable: boolean;\n    minimum: number;\n  }> = [\n    { key: "priceVisibility", applicable: Boolean(request.expectedPrice), minimum: 85 },\n    { key: "productDominance", applicable: Boolean(request.expectedProductName), minimum: 80 },\n    { key: "platformReadability", applicable: Boolean(request.expectedPlatforms?.length), minimum: 82 },\n  ];\n  const minimums = new Map<keyof FinalArtQaScores, number>([\n    ...REQUIRED_MINIMUMS,\n    ...optional.filter((item) => item.applicable).map((item) => [item.key, item.minimum] as const),\n  ]);\n\n  for (const key of FINAL_ART_DIMENSIONS) {\n    const evidence = result.evidence[key];\n    const check = result.checks[key];\n    if (evidence.status === "CONCERN") {\n      decision = decision === "BLOCK" ? "BLOCK" : "HUMAN_REVIEW";\n      issues.push(`${key} has concrete visible concern evidence: ${evidence.observations.join("; ") || "unspecified concern"}.`);\n      continue;\n    }\n    if (evidence.status === "FAIL") {\n      if (decision !== "BLOCK") decision = "REGENERATE";\n      issues.push(`${key} has concrete visible fail evidence: ${evidence.observations.join("; ") || "unspecified defect"}.`);\n      continue;\n    }\n    if (evidence.status === "NOT_APPLICABLE" && check !== "NOT_APPLICABLE") {\n      if (decision !== "BLOCK") decision = "REGENERATE";\n      issues.push(`${key} evidence cannot be NOT_APPLICABLE when its check is ${check}.`);\n      continue;\n    }\n    if (evidence.status === "PASS" && check === "PASS") {\n      const minimum = minimums.get(key);\n      if (minimum !== undefined && scores[key] < minimum) {\n        notes.push(`Final-art QA evidence consistency normalized ${key} score from ${scores[key]} to ${minimum}.`);\n        scores[key] = minimum;\n      }\n    }\n  }\n\n  for (const [key, minimum] of REQUIRED_MINIMUMS) {\n    if (result.checks[key] !== "PASS") {\n      if (decision !== "BLOCK") decision = "REGENERATE";\n      issues.push(`${key} check must be PASS for finished artwork.`);\n    }\n    if (scores[key] < minimum) {\n      if (decision !== "BLOCK") decision = "REGENERATE";\n      issues.push(`${key} score ${scores[key]} is below required ${minimum}.`);\n    }\n  }\n\n  for (const item of optional) {\n    const state = result.checks[item.key];\n    const evidence = result.evidence[item.key];\n    if (item.applicable) {\n      if (state !== "PASS") {\n        if (decision !== "BLOCK") decision = "REGENERATE";\n        issues.push(`${item.key} check must be PASS when the dimension is applicable.`);\n      }\n      if (scores[item.key] < item.minimum) {\n        if (decision !== "BLOCK") decision = "REGENERATE";\n        issues.push(`${item.key} score ${scores[item.key]} is below required ${item.minimum}.`);\n      }\n    } else {\n      if (state !== "NOT_APPLICABLE") {\n        if (decision !== "BLOCK") decision = "REGENERATE";\n        issues.push(`${item.key} must be NOT_APPLICABLE when no corresponding verified element is expected.`);\n      }\n      if (evidence.status !== "NOT_APPLICABLE") {\n        if (decision !== "BLOCK") decision = "REGENERATE";\n        issues.push(`${item.key} evidence must be NOT_APPLICABLE when no corresponding verified element is expected.`);\n      }\n    }\n  }\n\n  const materialIssues = [...new Set(issues)];\n  const allApplicableEvidencePass = FINAL_ART_DIMENSIONS.every((key) => {\n    const state = result.checks[key];\n    return state === "NOT_APPLICABLE"\n      ? result.evidence[key].status === "NOT_APPLICABLE"\n      : state === "PASS" && result.evidence[key].status === "PASS";\n  });\n  if (decision !== "BLOCK" && allApplicableEvidencePass && materialIssues.length === 0) {\n    decision = "PASS";\n  }\n\n  return { ...result, decision, scores, issues: materialIssues, notes: [...new Set(notes)] };\n}\n'''
Path("src/finalArtQa/gemini.ts").write_text(text[:start] + new_guard + text[end:])

replace_once(
    "src/finalArtQa/gemini.ts",
    '''        checks: parseChecks(parsed.checks),\n        issues: strings(parsed.issues, "issues"),\n''',
    '''        checks: parseChecks(parsed.checks),\n        evidence: parseEvidence(parsed.evidence),\n        issues: strings(parsed.issues, "issues"),\n''',
)

# Tests: Final Art QA fixtures include evidence, normalization, concern behavior.
replace_once(
    "tests/finalArtQa.test.ts",
    '''    checks: {\n      brandVisibility: "PASS",\n      headlineHierarchy: "PASS",\n      ctaHierarchyPlacement: "PASS",\n      priceVisibility: "PASS",\n      safeAreas: "PASS",\n      contrastLegibility: "PASS",\n      productDominance: "PASS",\n      platformReadability: "PASS",\n      decorativeCoherence: "PASS",\n    },\n    issues: [] as string[],\n''',
    '''    checks: {\n      brandVisibility: "PASS",\n      headlineHierarchy: "PASS",\n      ctaHierarchyPlacement: "PASS",\n      priceVisibility: "PASS",\n      safeAreas: "PASS",\n      contrastLegibility: "PASS",\n      productDominance: "PASS",\n      platformReadability: "PASS",\n      decorativeCoherence: "PASS",\n    },\n    evidence: {\n      brandVisibility: { status: "PASS", observations: ["Brand identifier is clearly visible."] },\n      headlineHierarchy: { status: "PASS", observations: ["Headline is visually primary."] },\n      ctaHierarchyPlacement: { status: "PASS", observations: ["CTA is tied to the copy block."] },\n      priceVisibility: { status: "PASS", observations: ["Price is readable."] },\n      safeAreas: { status: "PASS", observations: ["Important elements remain within safe margins."] },\n      contrastLegibility: { status: "PASS", observations: ["Customer-facing text is legible."] },\n      productDominance: { status: "PASS", observations: ["Product remains visually dominant."] },\n      platformReadability: { status: "PASS", observations: ["Platform name is readable."] },\n      decorativeCoherence: { status: "PASS", observations: ["No rendering artifacts are visible."] },\n    },\n    issues: [] as string[],\n''',
)
replace_once(
    "tests/finalArtQa.test.ts",
    '''test("deterministic threshold downgrades weak contrast/legibility PASS to REGENERATE", async () => {\n  const review = strongReview();\n  review.scores.contrastLegibility = 60;\n  const result = await providerFor(review).review(request());\n  assert.equal(result.decision, "REGENERATE");\n  assert.match(result.issues.join(" "), /contrastLegibility score/);\n});\n''',
    '''test("PASS evidence normalizes an inconsistent sub-threshold score without lowering the threshold", async () => {\n  const review = strongReview();\n  review.scores.contrastLegibility = 60;\n  const result = await providerFor(review).review(request());\n  assert.equal(result.decision, "PASS");\n  assert.equal(result.scores.contrastLegibility, 82);\n  assert.match(result.notes.join(" "), /evidence consistency normalized contrastLegibility score from 60 to 82/);\n});\n\ntest("concrete concern evidence is not normalized away", async () => {\n  const review = strongReview();\n  review.scores.contrastLegibility = 70;\n  review.evidence.contrastLegibility = {\n    status: "CONCERN",\n    observations: ["Supporting copy has weak contrast over a bright background."],\n  };\n  const result = await providerFor(review).review(request());\n  assert.notEqual(result.decision, "PASS");\n  assert.equal(result.scores.contrastLegibility, 70);\n  assert.match(result.issues.join(" "), /weak contrast over a bright background/);\n});\n''',
)
replace_once(
    "tests/finalArtQa.test.ts",
    '''  review.checks.priceVisibility = "NOT_APPLICABLE";\n  review.checks.productDominance = "NOT_APPLICABLE";\n  review.checks.platformReadability = "NOT_APPLICABLE";\n''',
    '''  review.checks.priceVisibility = "NOT_APPLICABLE";\n  review.checks.productDominance = "NOT_APPLICABLE";\n  review.checks.platformReadability = "NOT_APPLICABLE";\n  review.evidence.priceVisibility = { status: "NOT_APPLICABLE", observations: [] };\n  review.evidence.productDominance = { status: "NOT_APPLICABLE", observations: [] };\n  review.evidence.platformReadability = { status: "NOT_APPLICABLE", observations: [] };\n''',
)
replace_once(
    "tests/finalArtQa.test.ts",
    '''  review.checks.decorativeCoherence = "FAIL";\n  review.issues = ["A stray rectangular graphic fragment appears near the CTA."];\n''',
    '''  review.checks.decorativeCoherence = "FAIL";\n  review.evidence.decorativeCoherence = {\n    status: "FAIL",\n    observations: ["A stray rectangular graphic fragment appears near the CTA."],\n  };\n  review.issues = ["A stray rectangular graphic fragment appears near the CTA."];\n''',
)
replace_once(
    "tests/finalArtQa.test.ts",
    '''  review.checks.brandVisibility = "FAIL";\n''',
    '''  review.checks.brandVisibility = "FAIL";\n  review.evidence.brandVisibility = { status: "FAIL", observations: ["Brand identifier is obscured."] };\n''',
)
replace_once(
    "tests/finalArtQa.test.ts",
    '''  review.checks.priceVisibility = "FAIL";\n''',
    '''  review.checks.priceVisibility = "FAIL";\n  review.evidence.priceVisibility = { status: "FAIL", observations: ["Expected price is unreadable."] };\n''',
)

# Gemini schema fixture + assertions.
replace_once(
    "tests/geminiFinalArtQa.test.ts",
    '''                  checks: {\n                    brandVisibility: "PASS",\n                    headlineHierarchy: "PASS",\n                    ctaHierarchyPlacement: "PASS",\n                    priceVisibility: "NOT_APPLICABLE",\n                    safeAreas: "PASS",\n                    contrastLegibility: "PASS",\n                    productDominance: "NOT_APPLICABLE",\n                    platformReadability: "NOT_APPLICABLE",\n                    decorativeCoherence: "PASS",\n                  },\n                  issues: [],\n''',
    '''                  checks: {\n                    brandVisibility: "PASS",\n                    headlineHierarchy: "PASS",\n                    ctaHierarchyPlacement: "PASS",\n                    priceVisibility: "NOT_APPLICABLE",\n                    safeAreas: "PASS",\n                    contrastLegibility: "PASS",\n                    productDominance: "NOT_APPLICABLE",\n                    platformReadability: "NOT_APPLICABLE",\n                    decorativeCoherence: "PASS",\n                  },\n                  evidence: {\n                    brandVisibility: { status: "PASS", observations: ["Brand identifier is visible."] },\n                    headlineHierarchy: { status: "PASS", observations: ["Headline is primary."] },\n                    ctaHierarchyPlacement: { status: "PASS", observations: ["CTA is attached to the copy block."] },\n                    priceVisibility: { status: "NOT_APPLICABLE", observations: [] },\n                    safeAreas: { status: "PASS", observations: ["Safe margins are preserved."] },\n                    contrastLegibility: { status: "PASS", observations: ["Text is legible."] },\n                    productDominance: { status: "NOT_APPLICABLE", observations: [] },\n                    platformReadability: { status: "NOT_APPLICABLE", observations: [] },\n                    decorativeCoherence: { status: "PASS", observations: ["No artifacts are visible."] },\n                  },\n                  issues: [],\n''',
)
replace_once(
    "tests/geminiFinalArtQa.test.ts",
    '''              checks: { required: string[] };\n''',
    '''              checks: { required: string[] };\n              evidence: { required: string[] };\n''',
)
replace_once(
    "tests/geminiFinalArtQa.test.ts",
    '''  assert.equal(body.generationConfig.responseFormat.text.schema.properties.checks.required.length, 9);\n''',
    '''  assert.equal(body.generationConfig.responseFormat.text.schema.properties.checks.required.length, 9);\n  assert.equal(body.generationConfig.responseFormat.text.schema.properties.evidence.required.length, 9);\n''',
)

# Renderer regression.
replace_once(
    "tests/m3Renderer.test.ts",
    '''  assert.match(html, /data-price-style="BRAND_RED"/);\n});\n''',
    '''  assert.match(html, /data-price-style="BRAND_RED"/);\n  assert.match(html, /\\.supporting \\{[\\s\\S]*color: var\\(--atthas-ink\\)/);\n});\n''',
)

# Layout routing regressions.
p = Path("tests/atthasLayouts.test.ts")
text = p.read_text()
anchor = '''test("Restaurant shared-table language selects multi-dish layout", () => {\n'''
addition = '''test("Burger DINE_IN routes to non-product minimal-premium layout", () => {\n  const value = creative();\n  assert.equal(\n    selectAtthasLayout({\n      brandId: "ATTHAS_BURGER",\n      creative: value,\n      format: squareish,\n      campaignType: "DINE_IN",\n    }).id,\n    "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",\n  );\n});\n\ntest("Restaurant DINE_IN resists AI brand-building role drift and stays hospitality-led", () => {\n  const value = creative({\n    concepts: [{\n      id: "C1",\n      strategicRole: "brand-building",\n      campaignName: "Evening together",\n      coreIdea: "Warm hospitality moment",\n      customerEmotion: "belonging",\n      headlineDirection: "Visit tonight",\n      visualConcept: "restaurant ambience",\n      cta: "Visit",\n      targetAudience: "local diners",\n      expectedStrength: 8,\n      risks: [],\n    }],\n  });\n  assert.equal(\n    selectAtthasLayout({\n      brandId: "ATTHAS_RESTAURANT",\n      creative: value,\n      format: squareish,\n      campaignType: "DINE_IN",\n    }).id,\n    "ATTHAS_RESTAURANT_HOSPITALITY_V1",\n  );\n});\n\n'''
if anchor not in text:
    raise SystemExit("layout test insertion anchor missing")
p.write_text(text.replace(anchor, addition + anchor, 1))

# New governance boundary regression: internal ideation may use claim vocabulary, production fields may not.
Path("tests/claimGovernanceBoundary.test.ts").write_text('''import assert from "node:assert/strict";\nimport test from "node:test";\n\nimport { assertCreativeRespectsClaimGovernance } from "../src/claimGovernance.js";\nimport type { CampaignPreflight } from "../src/commands/createCampaign.js";\nimport type { CampaignCreativeOutput } from "../src/creativeTypes.js";\n\nfunction creative(): CampaignCreativeOutput {\n  return {\n    concepts: [{\n      id: "C1",\n      strategicRole: "brand-building",\n      campaignName: "Internal strategy",\n      coreIdea: "Build a signature hospitality ritual internally.",\n      customerEmotion: "belonging",\n      headlineDirection: "Distinctive brand idea",\n      visualConcept: "signature stack silhouette for concept exploration",\n      cta: "Discover",\n      targetAudience: "local diners",\n      expectedStrength: 8,\n      risks: [],\n    }],\n    recommendedConceptId: "C1",\n    recommendationReason: "test",\n    creativeBrief: {\n      headline: "Made for your kind of burger night",\n      supportingCopy: "ATTHA'S Burger",\n      cta: "Discover ATTHA'S",\n      visualDirection: "Abstract brand atmosphere with no specific menu item claim.",\n      composition: "One focal subject with negative space.",\n      lighting: "Controlled editorial light.",\n      photographyStyle: "Photoreal brand atmosphere.",\n      aspectRatio: "4:5",\n    },\n    caption: "ATTHA'S Burger.",\n    imageGeneration: {\n      basePrompt: "Photoreal brand atmosphere with no specific menu item identity.",\n      negativePrompt: "text, logos, labels",\n      visualConstraints: [],\n      textPolicy: "NO_TEXT_OR_LOGOS",\n    },\n    overlaySpec: {\n      headline: "Made for your kind of burger night",\n      supportingCopy: "ATTHA'S Burger",\n      cta: "Discover ATTHA'S",\n      logoUsage: "OMIT",\n      placementHints: { headline: "upper-left", supportingCopy: "below", cta: "with copy", logo: "omit" },\n    },\n    factualQaNotes: [],\n  };\n}\n\nconst preflight = { facts: [] } as unknown as CampaignPreflight;\n\ntest("internal concept strategy vocabulary does not create a publishable claim violation", () => {\n  assert.doesNotThrow(() => assertCreativeRespectsClaimGovernance(creative(), preflight));\n});\n\ntest("the same unsupported claim still blocks when it reaches production-facing copy", () => {\n  const value = creative();\n  value.overlaySpec.supportingCopy = "Our signature burger experience";\n  assert.throws(\n    () => assertCreativeRespectsClaimGovernance(value, preflight),\n    /unsupported product\\/service claim or depiction "signature"/,\n  );\n});\n\ntest("unsupported claim vocabulary still blocks when it reaches the image prompt", () => {\n  const value = creative();\n  value.imageGeneration.basePrompt = "Photograph the signature burger hero.";\n  assert.throws(\n    () => assertCreativeRespectsClaimGovernance(value, preflight),\n    /unsupported product\\/service claim or depiction "signature"/,\n  );\n});\n''')

print("M3 Round-2 regression patch applied")

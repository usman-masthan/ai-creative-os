from pathlib import Path

p = Path("tests/m3ExitCalibration.test.ts")
text = p.read_text()

base_checks = '''    checks: {\n      brandVisibility: "PASS" as const,\n      headlineHierarchy: "PASS" as const,\n      ctaHierarchyPlacement: "PASS" as const,\n      priceVisibility: "NOT_APPLICABLE" as const,\n      safeAreas: "PASS" as const,\n      contrastLegibility: "PASS" as const,\n      productDominance: "NOT_APPLICABLE" as const,\n      platformReadability: "NOT_APPLICABLE" as const,\n      decorativeCoherence: "PASS" as const,\n    },\n'''
base_evidence = base_checks + '''    evidence: {\n      brandVisibility: { status: "PASS" as const, observations: ["Brand identifier visible"] },\n      headlineHierarchy: { status: "PASS" as const, observations: ["Headline hierarchy clear"] },\n      ctaHierarchyPlacement: { status: "PASS" as const, observations: ["CTA placement clear"] },\n      priceVisibility: { status: "NOT_APPLICABLE" as const, observations: [] },\n      safeAreas: { status: "PASS" as const, observations: ["Safe areas preserved"] },\n      contrastLegibility: { status: "PASS" as const, observations: ["Copy legible"] },\n      productDominance: { status: "NOT_APPLICABLE" as const, observations: [] },\n      platformReadability: { status: "NOT_APPLICABLE" as const, observations: [] },\n      decorativeCoherence: { status: "PASS" as const, observations: ["No artifacts"] },\n    },\n'''
if text.count(base_checks) != 1:
    raise SystemExit(f"expected one base checks fixture, found {text.count(base_checks)}")
text = text.replace(base_checks, base_evidence, 1)

second_checks = '''      checks: {\n        brandVisibility: "PASS",\n        headlineHierarchy: "PASS",\n        ctaHierarchyPlacement: "PASS",\n        priceVisibility: "NOT_APPLICABLE",\n        safeAreas: "PASS",\n        contrastLegibility: "PASS",\n        productDominance: "NOT_APPLICABLE",\n        platformReadability: "NOT_APPLICABLE",\n        decorativeCoherence: "PASS",\n      },\n'''
second_evidence = second_checks + '''      evidence: {\n        brandVisibility: { status: "PASS", observations: ["Brand identifier visible"] },\n        headlineHierarchy: { status: "PASS", observations: ["Headline hierarchy clear"] },\n        ctaHierarchyPlacement: { status: "PASS", observations: ["CTA placement clear"] },\n        priceVisibility: { status: "NOT_APPLICABLE", observations: [] },\n        safeAreas: { status: "PASS", observations: ["Safe areas preserved"] },\n        contrastLegibility: { status: "PASS", observations: ["Copy legible"] },\n        productDominance: { status: "NOT_APPLICABLE", observations: [] },\n        platformReadability: { status: "NOT_APPLICABLE", observations: [] },\n        decorativeCoherence: { status: "PASS", observations: ["No artifacts"] },\n      },\n'''
if text.count(second_checks) != 1:
    raise SystemExit(f"expected one diagnosis checks fixture, found {text.count(second_checks)}")
text = text.replace(second_checks, second_evidence, 1)

p.write_text(text)
print("M3 calibration evidence fixtures patched")

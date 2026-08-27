import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { StructuredImageBrief } from "../src/structuredImageBrief.js";
import { compositionExpectationFromBrief } from "../src/visualQa/compositionExpectation.js";
import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";

const reportPathArg = process.env.M2_CALIBRATION_REPORT_PATH?.trim();
if (!reportPathArg) throw new Error("M2_CALIBRATION_REPORT_PATH is required and must point to m2-exit-calibration-report.json.");
if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is required for M2 QA-only recheck.");

const reportPath = resolve(reportPathArg);
const report = JSON.parse(await readFile(reportPath, "utf8")) as {
  calibrationOnly: boolean;
  publishable: boolean;
  product: { productId: string; productName: string; ingredients: string[] };
  selectedLayout: { brandId: "ATTHAS_RESTAURANT" | "ATTHAS_BURGER"; imageCompositionRequirements: string[] } | null;
  imageAttempts: Array<{ attempt: number; model: string; rawImagePath: string; structuredBrief: StructuredImageBrief | null }>;
};
if (report.calibrationOnly !== true || report.publishable !== false) throw new Error("Refusing QA recheck because the report is not calibration-only/non-publishable.");
if (!report.selectedLayout) throw new Error("Calibration report is missing selectedLayout.");

const qa = new GeminiVisualQaProvider();
const reviews = [];
for (const attempt of report.imageAttempts) {
  if (!attempt.structuredBrief) continue;
  const imagePath = resolve(attempt.rawImagePath);
  const bytes = await readFile(imagePath);
  const visualQa = await qa.review({
    imageBase64: bytes.toString("base64"),
    mimeType: imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
    brandId: report.selectedLayout.brandId,
    ...(attempt.structuredBrief.scope.branchId ? { branchId: attempt.structuredBrief.scope.branchId } : {}),
    productId: report.product.productId,
    productName: report.product.productName,
    visualClass: "CONSTRAINED_PRODUCT_GENERATION",
    rightsStatus: "cleared",
    verifiedVisibleIngredients: [...report.product.ingredients],
    mustInclude: ["one coherent wrap-style food hero"],
    mustNotInclude: ["unverified ingredients", "generated text", "ATTHA'S logo or signage", "price or offer text", "branded packaging", "dark rectangular panels", "CTA panels", "headline panels", "badges", "decorative graphic strips"],
    compositionRequirements: [...report.selectedLayout.imageCompositionRequirements, "preserve a genuinely quiet copy-safe area", "keep the food hero clear of the intended copy zone", "use a crop that remains safe for deterministic poster overlay"],
    compositionExpectation: compositionExpectationFromBrief(attempt.structuredBrief),
  });
  reviews.push({ attempt: attempt.attempt, imageModel: attempt.model, rawImagePath: imagePath, visualQa });
}
const output = { recheckedAt: new Date().toISOString(), sourceReportPath: reportPath, calibrationOnly: true, publishable: false, regeneratedImages: false, reviews };
const outputPath = resolve(dirname(reportPath), "m2-exit-qa-recheck.json");
await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
console.log(JSON.stringify(output, null, 2));

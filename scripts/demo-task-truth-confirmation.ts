import {
  confirmTaskTruth,
  prepareTaskTruthConfirmation,
  taskTruthSnapshotToRecords,
} from "../src/taskTruth.js";
import type { TruthRecord, TruthRequirement } from "../src/types.js";

const productId = "BEEF_CHEESE";
const requirements: TruthRequirement[] = [
  {
    key: "price",
    branchId: "BURGER_WELLAMPITIYA",
    productId,
    salesChannel: "DINE_IN",
  },
  {
    key: "price",
    branchId: "BURGER_BAMBALAPITIYA",
    productId,
    salesChannel: "DINE_IN",
  },
  {
    key: "branchAvailability",
    branchId: "BURGER_WELLAMPITIYA",
    productId,
  },
];

const storedTruth: TruthRecord[] = [
  {
    key: "price",
    value: 1150,
    status: "VERIFIED",
    sourceId: "EXAMPLE_STORED_PRICE",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      productId,
      salesChannel: "DINE_IN",
    },
  },
  {
    key: "price",
    value: 1150,
    status: "VERIFIED",
    sourceId: "EXAMPLE_STORED_PRICE",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_BAMBALAPITIYA",
      productId,
      salesChannel: "DINE_IN",
    },
  },
];

const questionnaire = prepareTaskTruthConfirmation({
  sessionId: "DEMO-TASK-TRUTH-001",
  campaignId: "DEMO-BEEF-CHEESE",
  tenantId: "T001",
  brandId: "ATTHAS_BURGER",
  requirements,
  records: storedTruth,
  createdAt: "2026-08-26T07:30:00.000Z",
});

console.log("\nTASK-SPECIFIC QUESTIONS\n");
for (const question of questionnaire.questions) {
  console.log(`- [${question.kind}] ${question.prompt}`);
}

const snapshot = confirmTaskTruth({
  questionnaire,
  confirmedBy: "demo-owner",
  confirmedAt: "2026-08-26T07:31:00.000Z",
  answers: questionnaire.questions.map((question) => {
    if (question.kind === "CONFIRM_STORED") {
      return { label: question.label, action: "CONFIRM" as const };
    }
    return {
      label: question.label,
      action: "PROVIDE" as const,
      // Demo only: a real UI must collect this from the user.
      value: true,
    };
  }),
});

console.log("\nCONFIRMED TASK SNAPSHOT\n");
console.log(JSON.stringify(snapshot, null, 2));

console.log("\nEPHEMERAL PRODUCTION TRUTH\n");
console.log(JSON.stringify(taskTruthSnapshotToRecords(snapshot), null, 2));

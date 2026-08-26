import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmTaskTruth,
  prepareTaskTruthConfirmation,
  taskTruthSnapshotToRecords,
  validateTaskTruthSnapshot,
} from "../src/taskTruth.js";
import { resolveTruth } from "../src/truthResolver.js";
import type { TruthRecord, TruthRequirement } from "../src/types.js";

const records: TruthRecord[] = [
  {
    key: "branchPhysicalAddress",
    value: "Urban City Food Court, Ambagaha Junction Rd, Kotikawatta",
    status: "VERIFIED",
    sourceId: "OWNER_BRANCH_MASTER_2026_08_25",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
    },
  },
  {
    key: "price",
    value: 1150,
    status: "VERIFIED",
    sourceId: "OWNER_PRICE_TEST",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      productId: "BEEF_CHEESE",
      salesChannel: "DINE_IN",
    },
  },
];

function baseInput(requirements: TruthRequirement[]) {
  return {
    sessionId: "SESSION-1",
    campaignId: "CAMPAIGN-1",
    tenantId: "T001" as const,
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    requirements,
    records,
    createdAt: "2026-08-26T10:00:00.000Z",
  };
}

test("stored verified facts are still presented for explicit task confirmation", () => {
  const questionnaire = prepareTaskTruthConfirmation(
    baseInput([{ key: "branchPhysicalAddress", branchId: "BURGER_WELLAMPITIYA" }]),
  );

  assert.equal(questionnaire.questions.length, 1);
  assert.equal(questionnaire.questions[0]?.kind, "CONFIRM_STORED");
  assert.equal(
    questionnaire.questions[0]?.storedValue,
    "Urban City Food Court, Ambagaha Junction Rd, Kotikawatta",
  );
  assert.match(questionnaire.questions[0]?.prompt ?? "", /Please confirm the stored/);
});

test("missing facts become input questions instead of blocking the user before they can answer", () => {
  const questionnaire = prepareTaskTruthConfirmation(
    baseInput([
      {
        key: "branchAvailability",
        branchId: "BURGER_WELLAMPITIYA",
        productId: "BEEF_CHEESE",
      },
    ]),
  );

  assert.equal(questionnaire.questions[0]?.kind, "PROVIDE_MISSING");
  assert.match(questionnaire.questions[0]?.prompt ?? "", /Please provide the current value/);
});

test("brief-derived missing facts are surfaced as suggested values for explicit confirmation", () => {
  const questionnaire = prepareTaskTruthConfirmation({
    ...baseInput([
      {
        key: "requestedProductClaims",
        branchId: "BURGER_WELLAMPITIYA",
        productId: "CHICKEN_TIKKA_WRAP",
      },
    ]),
    suggestedValues: {
      requestedProductClaims: "chicken tikka; creamy sauce; lettuce; onion; tomato; coriander",
    },
  });

  assert.equal(questionnaire.questions[0]?.kind, "PROVIDE_MISSING");
  assert.equal(
    questionnaire.questions[0]?.suggestedValue,
    "chicken tikka; creamy sauce; lettuce; onion; tomato; coriander",
  );
  assert.match(questionnaire.questions[0]?.prompt ?? "", /Your brief suggested/);
});

test("a complete confirmation creates an immutable task-scoped truth snapshot", () => {
  const questionnaire = prepareTaskTruthConfirmation(
    baseInput([
      { key: "branchPhysicalAddress", branchId: "BURGER_WELLAMPITIYA" },
      {
        key: "branchAvailability",
        branchId: "BURGER_WELLAMPITIYA",
        productId: "BEEF_CHEESE",
      },
    ]),
  );

  const snapshot = confirmTaskTruth({
    questionnaire,
    confirmedBy: "owner",
    confirmedAt: "2026-08-26T10:05:00.000Z",
    answers: [
      {
        label: "branchPhysicalAddress|branch=BURGER_WELLAMPITIYA",
        action: "CONFIRM",
      },
      {
        label:
          "branchAvailability|branch=BURGER_WELLAMPITIYA|product=BEEF_CHEESE",
        action: "PROVIDE",
        value: true,
      },
    ],
  });

  assert.equal(snapshot.facts.length, 2);
  assert.equal(snapshot.facts[0]?.value, records[0]?.value);
  assert.equal(snapshot.facts[1]?.value, true);
  const ephemeral = taskTruthSnapshotToRecords(snapshot);
  assert.equal(ephemeral.every((item) => item.status === "VERIFIED"), true);
  assert.equal(ephemeral[0]?.sourceId, "TASK_CONFIRMATION:SESSION-1");
});

test("correcting a stored value overrides it for the task without silently changing master truth", () => {
  const questionnaire = prepareTaskTruthConfirmation(
    baseInput([
      {
        key: "price",
        branchId: "BURGER_WELLAMPITIYA",
        productId: "BEEF_CHEESE",
        salesChannel: "DINE_IN",
      },
    ]),
  );

  const label = "price|branch=BURGER_WELLAMPITIYA|product=BEEF_CHEESE|salesChannel=DINE_IN";
  const snapshot = confirmTaskTruth({
    questionnaire,
    confirmedBy: "owner",
    answers: [{ label, action: "REPLACE", value: 1250, updateStoredTruth: false }],
  });

  assert.equal(snapshot.facts[0]?.previousStoredValue, 1150);
  assert.equal(snapshot.facts[0]?.value, 1250);
  assert.equal(snapshot.facts[0]?.updateStoredTruthRequested, false);
  assert.equal(records[1]?.value, 1150);
});

test("every required fact must be answered before a snapshot can be created", () => {
  const questionnaire = prepareTaskTruthConfirmation(
    baseInput([
      { key: "branchPhysicalAddress", branchId: "BURGER_WELLAMPITIYA" },
      { key: "physicalOpeningHours", branchId: "BURGER_WELLAMPITIYA" },
    ]),
  );

  assert.throws(
    () =>
      confirmTaskTruth({
        questionnaire,
        confirmedBy: "owner",
        answers: [
          {
            label: "branchPhysicalAddress|branch=BURGER_WELLAMPITIYA",
            action: "CONFIRM",
          },
        ],
      }),
    /missing answer for physicalOpeningHours/,
  );
});

test("branch-scoped prices cannot leak from one branch into another", () => {
  const result = resolveTruth({
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_BAMBALAPITIYA",
    requirements: [
      {
        key: "price",
        branchId: "BURGER_BAMBALAPITIYA",
        productId: "BEEF_CHEESE",
        salesChannel: "DINE_IN",
      },
    ],
    records,
  });

  assert.equal(result.pass, false);
  assert.deepEqual(result.facts, []);
  assert.deepEqual(result.missing, [
    "price|branch=BURGER_BAMBALAPITIYA|product=BEEF_CHEESE|salesChannel=DINE_IN",
  ]);
});

test("the same product price across multiple branches still requires separate confirmations", () => {
  const multiBranchRecords: TruthRecord[] = [
    records[1]!,
    {
      ...records[1]!,
      scope: {
        ...records[1]!.scope,
        branchId: "BURGER_BAMBALAPITIYA",
      },
    },
  ];
  const questionnaire = prepareTaskTruthConfirmation({
    sessionId: "SESSION-2",
    campaignId: "CAMPAIGN-2",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    requirements: [
      {
        key: "price",
        branchId: "BURGER_WELLAMPITIYA",
        productId: "BEEF_CHEESE",
        salesChannel: "DINE_IN",
      },
      {
        key: "price",
        branchId: "BURGER_BAMBALAPITIYA",
        productId: "BEEF_CHEESE",
        salesChannel: "DINE_IN",
      },
    ],
    records: multiBranchRecords,
  });

  assert.equal(questionnaire.questions.length, 2);
  assert.equal(questionnaire.questions.every((q) => q.kind === "CONFIRM_STORED"), true);
  assert.notEqual(questionnaire.questions[0]?.label, questionnaire.questions[1]?.label);
});

test("snapshot validation rejects scope or requirement drift", () => {
  const requirement: TruthRequirement = {
    key: "price",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "BEEF_CHEESE",
    salesChannel: "DINE_IN",
  };
  const questionnaire = prepareTaskTruthConfirmation(baseInput([requirement]));
  const snapshot = confirmTaskTruth({
    questionnaire,
    confirmedBy: "owner",
    answers: [
      {
        label: questionnaire.questions[0]!.label,
        action: "CONFIRM",
      },
    ],
  });

  const validation = validateTaskTruthSnapshot({
    snapshot,
    campaignId: "CAMPAIGN-OTHER",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    requirements: [requirement],
  });
  assert.equal(validation.valid, false);
  assert.match(validation.issues.join(" "), /campaignId mismatch/);
});

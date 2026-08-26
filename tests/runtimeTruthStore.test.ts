import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TaskTruthSnapshot } from "../src/taskTruth.js";
import type { TruthRecord } from "../src/types.js";
import {
  mergeTruthLayers,
  RuntimeTruthStore,
} from "../src/ui/runtimeTruthStore.js";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "atthas-runtime-truth-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("requested task correction is written back to the exact branch/product/channel scope", async () => {
  await withTempDir(async (dir) => {
    const store = new RuntimeTruthStore(dir);
    const snapshot: TaskTruthSnapshot = {
      schemaVersion: 1,
      sessionId: "task-1",
      campaignId: "C1",
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      confirmedBy: "owner",
      confirmedAt: "2026-08-26T08:00:00.000Z",
      facts: [
        {
          label: "price|branch=BURGER_WELLAMPITIYA|product=Beef Cheese Burger|salesChannel=DINE_IN",
          key: "price",
          value: 1250,
          scope: {
            tenantId: "T001",
            brandId: "ATTHAS_BURGER",
            branchId: "BURGER_WELLAMPITIYA",
            productId: "Beef Cheese Burger",
            salesChannel: "DINE_IN",
          },
          confirmationAction: "REPLACE",
          previousStoredValue: 1150,
          updateStoredTruthRequested: true,
        },
      ],
    };

    const written = await store.writeBackRequested(snapshot);
    assert.equal(written.length, 1);
    assert.equal(written[0]?.value, 1250);
    assert.equal(written[0]?.scope.branchId, "BURGER_WELLAMPITIYA");
    assert.equal(written[0]?.scope.productId, "Beef Cheese Burger");
    assert.equal(written[0]?.scope.salesChannel, "DINE_IN");
  });
});

test("runtime override replaces only the same exact stored scope", () => {
  const staticRecords: TruthRecord[] = [
    {
      key: "price",
      value: 1150,
      status: "VERIFIED",
      scope: {
        tenantId: "T001",
        brandId: "ATTHAS_BURGER",
        branchId: "BURGER_WELLAMPITIYA",
        productId: "Beef Cheese Burger",
        salesChannel: "DINE_IN",
      },
    },
    {
      key: "price",
      value: 1150,
      status: "VERIFIED",
      scope: {
        tenantId: "T001",
        brandId: "ATTHAS_BURGER",
        branchId: "BURGER_BAMBALAPITIYA",
        productId: "Beef Cheese Burger",
        salesChannel: "DINE_IN",
      },
    },
  ];
  const runtimeRecords: TruthRecord[] = [
    {
      key: "price",
      value: 1250,
      status: "OWNER_SOURCE_CONFIRMED",
      sourceId: "TASK_WRITEBACK:task-1",
      scope: staticRecords[0]!.scope,
    },
  ];

  const merged = mergeTruthLayers(staticRecords, runtimeRecords);
  assert.equal(merged.length, 2);
  const wellampitiya = merged.find((record) => record.scope.branchId === "BURGER_WELLAMPITIYA");
  const bambalapitiya = merged.find((record) => record.scope.branchId === "BURGER_BAMBALAPITIYA");
  assert.equal(wellampitiya?.value, 1250);
  assert.equal(bambalapitiya?.value, 1150);
});

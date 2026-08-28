import type { DesignDocument } from "../designDocument/types.js";
import type { DesignQaResult } from "./designQa.js";
import type { DesignApprovalRecord, FinalVisualQaRecord } from "./governanceStore.js";

export interface ApprovedExportEligibility {
  designId: string;
  designVersion: number;
  deterministicDecision: "PASS" | "WARN";
  finalVisualQaDecision: "PASS";
  approvedAt: string;
  approvedBy: string;
}

export function assertApprovedExportEligible(input: {
  document: DesignDocument;
  deterministicQa: DesignQaResult;
  finalVisualQa?: FinalVisualQaRecord;
  approval?: DesignApprovalRecord;
}): ApprovedExportEligibility {
  const { document, deterministicQa, finalVisualQa, approval } = input;
  if (deterministicQa.decision === "BLOCK") {
    throw new Error("APPROVED_EXPORT_BLOCK: deterministic QA has blocking issues.");
  }
  if (!finalVisualQa || finalVisualQa.designId !== document.id || finalVisualQa.designVersion !== document.version) {
    throw new Error("APPROVED_EXPORT_BLOCK: current design version has no final visual QA record.");
  }
  if (finalVisualQa.result.decision !== "PASS") {
    throw new Error(`APPROVED_EXPORT_BLOCK: final visual QA is ${finalVisualQa.result.decision}, not PASS.`);
  }
  if (!approval || approval.designId !== document.id || approval.designVersion !== document.version) {
    throw new Error("APPROVED_EXPORT_BLOCK: current design version has not been explicitly approved.");
  }
  if (approval.finalVisualQaDecision !== "PASS") {
    throw new Error("APPROVED_EXPORT_BLOCK: approval is not backed by a PASS final visual QA.");
  }
  return {
    designId: document.id,
    designVersion: document.version,
    deterministicDecision: deterministicQa.decision,
    finalVisualQaDecision: "PASS",
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
  };
}

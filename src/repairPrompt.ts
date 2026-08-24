export interface CampaignRepairPromptInput {
  originalPrompt: string;
  previousOutput: string;
  violation: string;
  repairAttempt: number;
}

export function buildCampaignRepairPrompt(input: CampaignRepairPromptInput): string {
  return `${input.originalPrompt}

REPAIR MODE — ATTEMPT ${input.repairAttempt}
The previous response failed deterministic validation and MUST be corrected.

VALIDATION FAILURE:
${input.violation}

PREVIOUS INVALID OUTPUT:
${input.previousOutput}

Repair only what is necessary while preserving the campaign objective and verified facts. Re-check every non-negotiable rule above. Return one complete replacement JSON object only. Do not explain the repair.`;
}

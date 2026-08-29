import type { CreativeTruthProviderDescriptor } from "./types.js";

export const ATTHAS_CREATIVE_TRUTH_PROVIDER: CreativeTruthProviderDescriptor = {
  providerId: "ATTHAS_UI_TRUTH_V1",
  clientId: "T001",
  endpoints: {
    bootstrap: "/api/ui/bootstrap",
    prepare: "/api/ui/prepare",
    confirm: "/api/ui/confirm",
    upload: "/api/ui/upload",
    produce: "/api/ui/produce",
  },
  confirmationRequired: true,
  immutableSnapshotRequired: true,
  factGateMode: "QUESTIONNAIRE_CONFIRMATION",
};

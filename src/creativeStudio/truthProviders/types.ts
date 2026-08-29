export interface CreativeTruthProviderEndpoints {
  bootstrap: string;
  prepare: string;
  confirm: string;
  upload: string;
  produce: string;
}

export interface CreativeTruthProviderDescriptor {
  providerId: string;
  clientId: string;
  endpoints: CreativeTruthProviderEndpoints;
  confirmationRequired: true;
  immutableSnapshotRequired: true;
  factGateMode: "QUESTIONNAIRE_CONFIRMATION";
}

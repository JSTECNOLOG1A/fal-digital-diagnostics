export const PROTHEUS_SYNC_QUEUE = 'protheus-sync';

export type ProtheusSyncJobPayload = {
  syncJobId: string;
  tenantId: string;
  resource: string;
};

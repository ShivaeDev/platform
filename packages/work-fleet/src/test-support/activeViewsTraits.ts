import { engineConfiguration } from "#test/engineConfiguration.ts";
export const occupiedBacklog = engineConfiguration("occupied backlog", () => ({ backlog: 1, foreignBacklog: true }));

export const unknownProviderQuota = engineConfiguration("unknown provider quota", () => ({ unknownQuota: true }));

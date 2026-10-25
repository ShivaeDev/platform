import type { EngineOptions } from "#test/EngineOptions.ts";

export function occupiedBacklogConfiguration() {
	return (): EngineOptions => ({ backlog: 1, foreignBacklog: true });
}
export function unknownProviderQuotaConfiguration() {
	return (): EngineOptions => ({ unknownQuota: true });
}

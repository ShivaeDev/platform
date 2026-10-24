import type { EngineOptions } from "#test/EngineOptions.ts";

export function oneSubmissionOfQuotaConfiguration() {
	return (): EngineOptions => ({ quota: 1 });
}

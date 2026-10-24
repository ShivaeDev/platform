import type { EngineOptions } from "#test/EngineOptions.ts";

export function twoSubmissionsOfQuotaConfiguration() {
	return (): EngineOptions => ({ noChange: true, quota: 2 });
}

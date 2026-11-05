import type { PgBossService } from "#server/service.ts";

export function failedJobs(state: Pick<PgBossService, "failedJobs">) {
	return state.failedJobs;
}

import type { PgBossService } from "#server/service.ts";

export function deadLetteredJobs(state: Pick<PgBossService, "deadLetteredJobs">) {
	return state.deadLetteredJobs;
}

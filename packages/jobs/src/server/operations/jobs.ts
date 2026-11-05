import type { PgBossInspectionService } from "#server/inspection.ts";

export function jobs(state: Pick<PgBossInspectionService, "jobs">) {
	return state.jobs;
}

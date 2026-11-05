import type { PgBossInspectionService } from "#server/inspection.ts";

export function storedJobs(state: Pick<PgBossInspectionService, "storedJobs">) {
	return state.storedJobs;
}

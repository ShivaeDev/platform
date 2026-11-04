import type { PgBossService } from "#server/service.ts";

export function getJob(state: Pick<PgBossService, "getJob">) {
	return state.getJob;
}

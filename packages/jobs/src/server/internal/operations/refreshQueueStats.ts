import type { PgBossService } from "#server/service.ts";

export function refreshQueueStats(state: Pick<PgBossService, "refreshQueueStats">) {
	return state.refreshQueueStats;
}

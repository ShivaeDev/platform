import type { PgBossInspectionService } from "#server/inspection.ts";

export function queue(state: Pick<PgBossInspectionService, "queue">) {
	return state.queue;
}

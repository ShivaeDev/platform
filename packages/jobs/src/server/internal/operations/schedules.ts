import type { PgBossInspectionService } from "#server/inspection.ts";

export function schedules(state: Pick<PgBossInspectionService, "schedules">) {
	return state.schedules;
}

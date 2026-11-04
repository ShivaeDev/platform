import type { PgBossInspectionService } from "#server/inspection.ts";

export function inspectionHealth(state: Pick<PgBossInspectionService, "health">) {
	return state.health;
}

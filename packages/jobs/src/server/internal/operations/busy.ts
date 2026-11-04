import type { PgBossInspectionService } from "#server/inspection.ts";

export function busy(state: Pick<PgBossInspectionService, "busy">) {
	return state.busy;
}

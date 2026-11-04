import type { PgBossInspectionService } from "#server/inspection.ts";

export function snapshot(state: Pick<PgBossInspectionService, "snapshot">) {
	return state.snapshot;
}

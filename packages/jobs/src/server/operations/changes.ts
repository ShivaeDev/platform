import type { PgBossInspectionService } from "#server/inspection.ts";

export function changes(state: Pick<PgBossInspectionService, "changes">) {
	return state.changes;
}

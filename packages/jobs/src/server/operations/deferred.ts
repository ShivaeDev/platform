import type { PgBossInspectionService } from "#server/inspection.ts";

export function deferred(state: Pick<PgBossInspectionService, "deferred">) {
	return state.deferred;
}

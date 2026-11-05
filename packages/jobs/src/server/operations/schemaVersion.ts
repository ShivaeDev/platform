import type { PgBossInspectionService } from "#server/inspection.ts";

export function schemaVersion(state: Pick<PgBossInspectionService, "schemaVersion">) {
	return state.schemaVersion;
}

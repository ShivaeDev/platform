import type { PgBossService } from "#server/service.ts";

export function inspection(state: Pick<PgBossService, "inspection">) {
	return state.inspection;
}

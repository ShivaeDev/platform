import type { PgBossService } from "#server/service.ts";

export function unschedule(state: Pick<PgBossService, "unschedule">) {
	return state.unschedule;
}

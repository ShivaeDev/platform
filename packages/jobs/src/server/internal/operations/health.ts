import type { PgBossService } from "#server/service.ts";

export function health(state: Pick<PgBossService, "health">) {
	return state.health;
}

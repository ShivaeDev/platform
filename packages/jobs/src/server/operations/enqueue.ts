import type { PgBossService } from "#server/service.ts";

export function enqueue(state: Pick<PgBossService, "enqueue">) {
	return state.enqueue;
}

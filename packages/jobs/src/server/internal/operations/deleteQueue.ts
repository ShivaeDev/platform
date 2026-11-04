import type { PgBossService } from "#server/service.ts";

export function deleteQueue(state: Pick<PgBossService, "deleteQueue">) {
	return state.deleteQueue;
}

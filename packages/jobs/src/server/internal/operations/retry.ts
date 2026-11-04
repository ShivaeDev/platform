import type { PgBossService } from "#server/service.ts";

export function retry(state: Pick<PgBossService, "retry">) {
	return state.retry;
}

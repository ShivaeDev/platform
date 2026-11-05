import type { PgBossService } from "#server/service.ts";

export function counts(state: Pick<PgBossService, "counts">) {
	return state.counts;
}

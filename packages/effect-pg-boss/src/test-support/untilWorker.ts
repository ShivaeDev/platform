import type { PgBoss } from "pg-boss";
import { until } from "#test/until.ts";

export function untilWorker(client: PgBoss, name: string) {
	return until(() => Promise.resolve(client.getWipData().find((worker) => worker.name === name && worker.lastFetchedOn !== null)));
}

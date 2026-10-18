import { Effect } from "effect";
import type { PgBoss } from "pg-boss";
import { eventually } from "#test/eventually.ts";

export function untilWorker(client: PgBoss, name: string) {
	return eventually(
		Effect.sync(() => client.getWipData().find((worker) => worker.name === name && worker.lastFetchedOn !== null)),
		(worker) => worker !== undefined,
	);
}

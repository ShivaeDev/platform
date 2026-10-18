import { Effect } from "effect";
import type { PgBoss } from "pg-boss";
import { eventually } from "@shivaedev/effect-test/eventually.ts";

export function untilWorker(client: PgBoss, name: string) {
	return eventually(
		Effect.sync(() => client.getWipData().find((worker) => worker.name === name && worker.lastFetchedOn !== null)).pipe(
			Effect.filterOrFail((worker) => worker !== undefined),
		),
		{ interval: 50 },
	).pipe(Effect.timeout(15_000));
}

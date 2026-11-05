import { Effect } from "effect";
import { healthFor } from "#server/adapters/healthFor.ts";
import { PgBoss } from "#server/PgBoss.ts";
export const health = Effect.fn("PgBossInspectionReads.health")(function* (queues: readonly { readonly name: string }[]) {
	const { client } = yield* PgBoss;
	return yield* healthFor(
		client,
		queues.map(({ name }) => name),
	);
});

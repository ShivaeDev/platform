import { Effect } from "effect";
import { healthFor } from "#server/adapters/healthFor.ts";
import { JobQueues } from "#server/JobQueues.ts";
import { PgBoss } from "#server/PgBoss.ts";
export const health = Effect.fn("PgBossOperations.health")(function* (queues?: readonly { readonly name: string }[]) {
	const { client } = yield* PgBoss;
	const names = yield* JobQueues;
	return yield* healthFor(client, queues?.map(({ name }) => name) ?? names);
});

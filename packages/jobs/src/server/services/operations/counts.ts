import { Effect } from "effect";
import { countsFor } from "#server/adapters/countsFor.ts";
import { PgBoss } from "#server/PgBoss.ts";
export const counts = Effect.fn("PgBossOperations.counts")(function* (queue: { readonly name: string }) {
	const { client, schema } = yield* PgBoss;
	return yield* countsFor(client, schema ?? "pgboss", queue.name);
});

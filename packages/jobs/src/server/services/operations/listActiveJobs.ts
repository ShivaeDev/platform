import { Effect } from "effect";
import type { KeysetPageQuery } from "@shivaedev/sql/keysetPage.ts";
import { listActiveJobs as listActive } from "#server/adapters/listActiveJobs.ts";
import { PgBoss } from "#server/PgBoss.ts";
export const listActiveJobs = Effect.fn("PgBossOperations.listActiveJobs")(function* (queue: string, query: KeysetPageQuery) {
	const { client, schema } = yield* PgBoss;
	return yield* listActive(client, schema ?? "pgboss", queue, query);
});

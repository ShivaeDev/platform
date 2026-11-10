import { Context, Effect, Layer, Redacted, Result } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { advisoryXactLock } from "@shivaedev/sql/advisoryXactLock.ts";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgresMigration } from "#postgresMigration.ts";
import { postgresStore } from "#postgresStore.ts";
import { postgresTestDatabase } from "#postgresTestDatabase.ts";
import { rateLimit } from "#rateLimit.ts";
import { Store } from "#Store.ts";
import { limit, makeLimiter } from "#test/makeLimiter.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");

const database = makePostgresTestLayer({
	...clientOptions({ url: Redacted.make(url ?? "postgresql://integration-tests-disabled") }),
	maxConnections: 3,
	migrations: { loader: Migrator.fromRecord({ "1_rate_limits": postgresMigration }), lockTimeout: "5 seconds" },
});

export const postgres = storyKit({
	around: withIsolatedDatabase,
	*create() {
		const local = yield* Layer.build(Layer.fresh(postgresStore));
		const clone = yield* PostgresTestDatabase;
		const remote = yield* Layer.build(postgresStore.pipe(Layer.provide(postgresLayer(clone.url, clientOptions({ maxConnections: 2 })))));
		const limiter = yield* makeLimiter.pipe(Effect.provideContext(local));
		return { limiter, local, remote, sql: yield* SqlClient.SqlClient, storage: yield* postgresTestDatabase };
	},
	layer: database,
	name: "PostgreSQL rate limits",
	runIf: configured,
	stages: [],
	verbs: ({ limiter, local, remote, sql, storage }) => ({
		attempt: limiter.attempt,
		burst: limiter.burst,
		expireWindows: () => limiter.passTime(limit.window).pipe(Effect.andThen(storage.expireWindows)),
		race: () =>
			Effect.gen(function* () {
				const options = { ...limit, per: 1 };
				const results = yield* raceWithLock({
					effects: [
						rateLimit(options).pipe(Effect.provideService(Store, Context.get(local, Store))),
						rateLimit(options).pipe(Effect.provideService(Store, Context.get(remote, Store))),
					],
					lock: advisoryXactLock(`@shivaedev/rate-limit:${limit.key}`),
				});
				return results
					.map((result) => {
						if (Result.isSuccess(result)) {
							return "admitted";
						}
						return result.failure instanceof TooManyRequests ? "TooManyRequests" : "store failure";
					})
					.sort();
			}),
		request: limiter.request,
		storageUnavailable: () => sql`drop table rate_limit_windows`,
	}),
});

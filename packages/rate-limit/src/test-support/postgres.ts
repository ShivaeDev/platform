import { Config, Context, Effect, Layer, Option, Redacted, Result } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { advisoryXactLock } from "@shivaedev/sql/advisoryXactLock.ts";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgresMigration } from "#adapters/postgresMigration.ts";
import { postgresStore } from "#adapters/postgresStore.ts";
import { rateLimit } from "#rateLimit.ts";
import { Store } from "#Store.ts";
import { TooManyRequests } from "#TooManyRequests.ts";
import { limit, makeLimiter } from "./makeLimiter.ts";

const url = Option.getOrUndefined(Effect.runSync(Config.option(Config.String("PLATFORM_SQL_TEST_DATABASE_URL"))));
const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")));
if (url === undefined && ci !== "") {
	throw new Error("CI requires PLATFORM_SQL_TEST_DATABASE_URL; PostgreSQL tests must not skip.");
}

const database = makePostgresTestLayer({
	...clientOptions({ url: Redacted.make(url ?? "postgresql://integration-tests-disabled") }),
	maxConnections: 3,
	migrations: { loader: Migrator.fromRecord({ "1_rate_limits": postgresMigration }), lockTimeout: "5 seconds" },
});

export const postgres = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const local = yield* Layer.build(Layer.fresh(postgresStore));
		const clone = yield* PostgresTestDatabase;
		const remote = yield* Layer.build(postgresStore.pipe(Layer.provide(postgresLayer(clone.url, clientOptions({ maxConnections: 2 })))));
		const limiter = yield* makeLimiter.pipe(Effect.provideContext(local));
		return { limiter, local, remote, sql: yield* SqlClient.SqlClient };
	},
	layer: database,
	name: "PostgreSQL rate limits",
	runIf: url !== undefined,
	stages: [],
	verbs: ({ limiter, local, remote, sql }) => ({
		attempt: limiter.attempt,
		burst: limiter.burst,
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
		storageUnavailable: () => sql`drop table rate_limit_windows`,
	}),
});

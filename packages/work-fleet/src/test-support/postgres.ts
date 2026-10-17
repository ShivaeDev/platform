import { Config, Effect, Option, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { makePostgresTestLayer, type PostgresTestOptions } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

const url = Option.getOrUndefined(Effect.runSync(Config.option(Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"))));
const ci = Effect.runSync(Config.String("CI").pipe(Config.withDefault("")));
if (url === undefined && ci !== "") {
	throw new Error("CI requires PLATFORM_EFFECT_SQL_TEST_DATABASE_URL; skipped PostgreSQL tests prove nothing.");
}

const postgresOptions = {
	migrations: {
		loader: Migrator.fromRecord({
			"1_fleet": migrateFleet(STORAGE_NAMESPACE),
			"2_storage_fields": Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`alter table ${sql(`${STORAGE_NAMESPACE}_records`)} add column "operationId" text, add column "sessionId" text,
					add column "submittedAt" double precision, add column "turnId" text`;
			}),
		}),
		lockTimeout: "5 seconds",
	},
	url: Redacted.make(url ?? "postgresql://integration-tests-disabled"),
} satisfies PostgresTestOptions;

const postgresLayer = makePostgresTestLayer(postgresOptions);

function makeTests(clock: "live" | "test", isolation: "rollback" | "isolated", options?: Pick<PostgresTestOptions, "maxConnections">) {
	const { effectApp } = makeEffectIt({
		around: isolation === "rollback" ? withTestTransaction : withIsolatedDatabase,
		clock,
		layer: options === undefined ? postgresLayer : makePostgresTestLayer({ ...postgresOptions, ...options }),
		makeHarness: () => Effect.void,
	});
	return effectApp.skipIf(url === undefined);
}

const testers = {
	isolated: { live: makeTests("live", "isolated"), test: makeTests("test", "isolated") },
	rollback: { live: makeTests("live", "rollback"), test: makeTests("test", "rollback") },
};

export function postgresTests(
	clock: "live" | "test",
	isolation: "rollback" | "isolated" = "rollback",
	options?: Pick<PostgresTestOptions, "maxConnections">,
) {
	return options === undefined ? testers[isolation][clock] : makeTests(clock, isolation, options);
}

import { Config, Effect } from "effect";
import { assertLocalDatabase, LOCAL_SERVER } from "@shivaedev/local-postgres/server/localPostgres.ts";

export const postgresTestEnvironment = Effect.gen(function* () {
	const connection = yield* Config.String("TEST_DATABASE_URL").pipe(Config.withDefault(`${LOCAL_SERVER}/platform_test`));
	const base = assertLocalDatabase(connection, ["platform_test"]);
	function select(name: string) {
		return Effect.gen(function* () {
			const database = `platform_test_${name.toLowerCase()}`;
			const url = new URL(base);
			url.pathname = `/${database}`;
			const value = yield* Config.String(`PLATFORM_${name}_TEST_DATABASE_URL`).pipe(Config.withDefault(url.toString()));
			assertLocalDatabase(value, [database]);
			return value;
		});
	}
	return yield* Effect.all({
		"PLATFORM_JOBS_TEST_DATABASE_URL": select("JOBS"),
		"PLATFORM_SQL_TEST_DATABASE_URL": select("SQL"),
		"PLATFORM_TEST_SQL_TEST_DATABASE_URL": select("TEST_SQL"),
	});
});

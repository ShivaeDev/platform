import { Config, Effect } from "effect";
import { assertLocalDatabase, LOCAL_SERVER } from "@shivaedev/local-postgres/server/localPostgres.ts";

export const postgresTestEnvironment = Effect.gen(function* () {
	const connection = yield* Config.String("TEST_DATABASE_URL").pipe(Config.withDefault(`${LOCAL_SERVER}/platform_test`));
	const base = assertLocalDatabase(connection, ["platform_test"]);
	function select(name: string) {
		return Effect.gen(function* () {
			const database = `platform_test_effect_${name.toLowerCase()}`;
			const url = new URL(base);
			url.pathname = `/${database}`;
			const value = yield* Config.String(`PLATFORM_EFFECT_${name}_TEST_DATABASE_URL`).pipe(Config.withDefault(url.toString()));
			assertLocalDatabase(value, [database]);
			return value;
		});
	}
	return yield* Effect.all({
		"PLATFORM_EFFECT_CHANGES_PRISMA_TEST_DATABASE_URL": select("CHANGES_PRISMA"),
		"PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL": select("PG_BOSS"),
		"PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL": select("PRISMA"),
		"PLATFORM_EFFECT_SQL_TEST_DATABASE_URL": select("SQL"),
		"PLATFORM_EFFECT_TEST_SQL_TEST_DATABASE_URL": select("TEST_SQL"),
	});
});

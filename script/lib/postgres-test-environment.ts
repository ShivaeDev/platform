import { assertLocalDatabase, localServer } from "@shivaedev/local-postgres";
import { Config, Effect } from "effect";

export const postgresTestEnvironment = Effect.gen(function* () {
	const connection = yield* Config.string("TEST_DATABASE_URL").pipe(Config.withDefault(`${localServer}/platform_test`));
	const base = assertLocalDatabase(connection, ["platform_test"]);
	const select = (name: string) =>
		Effect.gen(function* () {
			const database = `platform_test_effect_${name.toLowerCase()}`;
			const url = new URL(base);
			url.pathname = `/${database}`;
			const value = yield* Config.string(`PLATFORM_EFFECT_${name}_TEST_DATABASE_URL`).pipe(Config.withDefault(url.toString()));
			assertLocalDatabase(value, [database]);
			return value;
		});
	return yield* Effect.all({
		PLATFORM_EFFECT_CHANGES_PRISMA_TEST_DATABASE_URL: select("CHANGES_PRISMA"),
		PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL: select("PG_BOSS"),
		PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL: select("PRISMA"),
		PLATFORM_EFFECT_SQL_TEST_DATABASE_URL: select("SQL"),
	});
});

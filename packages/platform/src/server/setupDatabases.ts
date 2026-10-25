import { Config, Effect } from "effect";
import { localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";

export const setupDatabases = Effect.fn("Platform.setupDatabases")(function* () {
	const config = yield* Config.all({
		"DATABASE_URL": Config.String("DATABASE_URL"),
		"DOCKER_CONTEXT": Config.String("DOCKER_CONTEXT").pipe(Config.withDefault("")),
		"DOCKER_HOST": Config.String("DOCKER_HOST").pipe(Config.withDefault("")),
		"TEST_DATABASE_URL": Config.String("TEST_DATABASE_URL"),
	});
	yield* Effect.sync(() => localPostgres(config).prepareDatabases([config.DATABASE_URL, config.TEST_DATABASE_URL]));
});

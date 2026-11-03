import { Config, Effect } from "effect";
import { dockerEnvironment } from "@shivaedev/local-postgres/server/dockerEnvironment.ts";
import { localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";

export const setupDatabases = Effect.fn("Platform.setupDatabases")(function* () {
	const config = yield* Config.all({
		"DATABASE_URL": Config.String("DATABASE_URL"),
		"TEST_DATABASE_URL": Config.String("TEST_DATABASE_URL"),
	});
	const environment = yield* dockerEnvironment;
	yield* localPostgres(environment).prepareDatabases([config.DATABASE_URL, config.TEST_DATABASE_URL]);
});

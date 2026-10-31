import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect } from "effect";
import { LocalPostgresError } from "@shivaedev/local-postgres/server/LocalPostgresError.ts";
import { assertLocalDatabase, LOCAL_SERVER, localPostgres } from "@shivaedev/local-postgres/server/localPostgres.ts";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";

const setup = Effect.gen(function* () {
	if ((yield* Config.String("NODE_ENV").pipe(Config.withDefault(""))) === "production") {
		return yield* new LocalPostgresError({ message: "Local setup must not run in production." });
	}
	const environment = yield* Config.all({
		"DOCKER_CONTEXT": Config.String("DOCKER_CONTEXT").pipe(Config.withDefault("")),
		"DOCKER_HOST": Config.String("DOCKER_HOST").pipe(Config.withDefault("")),
	});
	const development = yield* Config.String("DATABASE_URL").pipe(Config.withDefault(`${LOCAL_SERVER}/platform_dev`));
	const tests = yield* postgresTestEnvironment;
	yield* assertLocalDatabase(development, ["platform_dev"]);
	yield* localPostgres(environment).prepareDatabases([development, ...Object.values(tests)]);
	yield* Effect.log("Local development and integration databases are ready.");
});

NodeRuntime.runMain(setup.pipe(Effect.provide(NodeServices.layer)));

import { readFileSync } from "node:fs";
import { Config, Effect, Schema } from "effect";
import { assertLocalDatabase, localPostgres, localServer } from "@shivaedev/local-postgres/localPostgres.ts";

const { name } = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ name: Schema.String })))(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const database = (name.split("/").at(-1) ?? name)
	.replaceAll(/[.-]/gu, "_")
	.replace(/^[^a-z]/u, "app_$&")
	.slice(0, 58);
const development = Effect.runSync(Config.string("DATABASE_URL").pipe(Config.withDefault(`${localServer}/${database}_dev`)));
const tests = Effect.runSync(Config.string("TEST_DATABASE_URL").pipe(Config.withDefault(`${localServer}/${database}_test`)));
assertLocalDatabase(development, [`${database}_dev`]);
assertLocalDatabase(tests, [`${database}_test`]);
localPostgres(
	Effect.runSync(
		Config.all({
			"DOCKER_CONTEXT": Config.string("DOCKER_CONTEXT").pipe(Config.withDefault("")),
			"DOCKER_HOST": Config.string("DOCKER_HOST").pipe(Config.withDefault("")),
		}),
	),
).prepareDatabases([development, tests]);

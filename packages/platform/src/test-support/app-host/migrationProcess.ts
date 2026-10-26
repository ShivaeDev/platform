import process from "node:process";
import { NodeRuntime } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { appDatabase } from "#server/appHost.ts";
import { migrationLoader } from "./migrationLoader.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const table = yield* Config.String("HOST_MIGRATION_TABLE");
		const databaseUrl = yield* Config.Redacted("DATABASE_URL");
		const schema = yield* Config.String("HOST_JOBS_SCHEMA").pipe(Config.withDefault(""));
		yield* Layer.build(
			appDatabase({
				config: { databaseUrl },
				migrations: {
					components: schema === "" ? [] : [pgBossSchema({ schema })],
					loader: migrationLoader(table, process.argv[2] === "initial"),
					table: `${table}_migrations`,
				},
			}),
		);
	}).pipe(Effect.scoped),
);

import process from "node:process";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Effect, Layer, Redacted } from "effect";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { appDatabase } from "#appDatabase.ts";
import { migrationLoader } from "#test/app-host/migrationLoader.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const table = yield* Config.String("HOST_MIGRATION_TABLE");
		const databaseUrl = Redacted.make(postgresTestUrl("DATABASE_URL").url ?? "postgresql://integration-tests-disabled");
		const schema = yield* Config.String("HOST_JOBS_SCHEMA").pipe(Config.withDefault(""));
		yield* Layer.build(
			appDatabase({
				config: { databaseUrl },
				migrations: {
					components: schema === "" ? [] : [pgBossSchema({ schema })],
					loader: migrationLoader(table, process.argv[2] === "initial"),
					table: `${table}_migrations`,
				},
				postgresSettings: {},
			}),
		);
	}).pipe(Effect.scoped, Effect.provide(NodeCrypto.layer)),
);

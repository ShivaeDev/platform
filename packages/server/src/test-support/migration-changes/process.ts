import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Effect, Layer, Redacted } from "effect";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { appDatabase } from "#appDatabase.ts";
import { migrationChangesLoader } from "./loader.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const databaseUrl = Redacted.make(postgresTestUrl("DATABASE_URL").url ?? "postgresql://integration-tests-disabled");
		const table = yield* Config.String("MIGRATION_NOTES_TABLE");
		const mode = yield* Config.String("MIGRATION_MODE");
		yield* Layer.build(
			appDatabase({
				config: { changes: { channel: table }, databaseUrl },
				migrations: { loader: migrationChangesLoader(table, mode === "rollback" ? "rollback" : "migrate"), table: `${table}_ledger` },
			}),
		);
	}).pipe(Effect.scoped, Effect.provide(NodeCrypto.layer)),
);

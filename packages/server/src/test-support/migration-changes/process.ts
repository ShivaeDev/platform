import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Effect, Layer } from "effect";
import { appDatabase } from "#appDatabase.ts";
import { migrationChangesLoader } from "./loader.ts";

NodeRuntime.runMain(
	Effect.gen(function* () {
		const databaseUrl = yield* Config.Redacted("DATABASE_URL");
		const table = yield* Config.String("MIGRATION_NOTES_TABLE");
		const mode = yield* Config.String("MIGRATION_MODE");
		yield* Layer.build(
			appDatabase({
				config: { changes: { channel: table }, databaseUrl },
				migrations: { loader: migrationChangesLoader(table, mode === "rollback" ? "rollback" : "migrate"), table: `${table}_ledger` },
			}),
		);
	}).pipe(Effect.scoped),
);

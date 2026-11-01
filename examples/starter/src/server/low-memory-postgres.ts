import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Effect } from "effect";
import { applyLowMemoryPostgres } from "@shivaedev/sql/applyLowMemoryPostgres.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";

const lowMemoryPostgres = Effect.gen(function* () {
	const url = yield* Config.Redacted("DATABASE_URL");
	const pointInTimeRecovery = yield* Config.Boolean("POSTGRES_POINT_IN_TIME_RECOVERY");
	yield* applyLowMemoryPostgres({ pointInTimeRecovery }).pipe(Effect.provide(postgresLayer(url)));
	yield* Effect.logInfo("PostgreSQL settings written; restart PostgreSQL to activate the shared-memory settings.");
});

NodeRuntime.runMain(lowMemoryPostgres.pipe(Effect.scoped));

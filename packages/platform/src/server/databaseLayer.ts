import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { postgresChanges } from "@shivaedev/effect-sql/postgresChanges.ts";
import type { AppChanges, AppDatabaseOptions } from "./appHost.ts";

export function databaseLayer<R>(options: AppDatabaseOptions<R>, changesService: typeof AppChanges) {
	const pool = Layer.unwrap(
		Effect.gen(function* () {
			const url = options.config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			return PgClient.layer({
				url,
				...(options.config?.maxConnections === undefined ? {} : { maxConnections: options.config.maxConnections }),
				...(options.config?.applicationName === undefined ? {} : { applicationName: options.config.applicationName }),
			});
		}),
	);
	const migrated = Layer.effectDiscard(migratePostgres({ ...options.migrations, lockTimeout: options.migrations.lockTimeout ?? "5 seconds" })).pipe(
		Layer.provideMerge(pool),
	);
	const live = Layer.effect(changesService, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer));
	const base = Layer.merge(migrated, live);
	const changes = options.config?.changes;
	if (changes === undefined) {
		return base;
	}
	return Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			const hints = yield* changesService;
			return postgresChanges({ ...changes, client, resync: hints.resync });
		}),
	).pipe(Layer.provideMerge(base));
}

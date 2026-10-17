import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer, type Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { assertPostgresMigrations } from "@shivaedev/effect-sql/assertPostgresMigrations.ts";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/effect-sql/postgresChanges.ts";
import type { AppChanges, AppDatabaseOptions } from "#server/appHost.ts";

export interface DatabaseConfig {
	readonly applicationName?: string;
	readonly changes?: Omit<PostgresChangesOptions, "client" | "resync">;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly maxConnections?: number;
}

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
	const prepared = Layer.effectDiscard(
		options.migrations.mode === "check"
			? assertPostgresMigrations(options.migrations)
			: migratePostgres({ ...options.migrations, lockTimeout: options.migrations.lockTimeout ?? "5 seconds" }),
	).pipe(Layer.provideMerge(pool));
	const live = Layer.effect(changesService, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer));
	const base = Layer.merge(prepared, live);
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

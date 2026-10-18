import { createHash } from "node:crypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer, Redacted, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { assertPostgresMigrations } from "@shivaedev/effect-sql/assertPostgresMigrations.ts";
import type { SqlNameTransforms } from "@shivaedev/effect-sql/clientOptions.ts";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/effect-sql/postgresChanges.ts";
import type { AppChanges, AppDatabaseOptions } from "#server/appHost.ts";
import { databaseAddress } from "./databaseAddress.ts";

export interface DatabaseConfig extends SqlNameTransforms {
	readonly applicationName?: string;
	readonly changes?: Partial<Omit<PostgresChangesOptions, "client" | "resync">>;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly maxConnections?: number;
}

export function databaseLayer<R>(options: AppDatabaseOptions<R>, changesService: typeof AppChanges) {
	const pool = Layer.unwrap(
		Effect.gen(function* () {
			const url = options.config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			return PgClient.layer({
				transformQueryNames: options.config?.transformQueryNames,
				transformResultNames: options.config?.transformResultNames,
				url,
				...databaseAddress(url),
				...(options.config?.maxConnections === undefined ? {} : { maxConnections: options.config.maxConnections }),
				...(options.config?.applicationName === undefined ? {} : { applicationName: options.config.applicationName }),
			});
		}),
	);
	const prepared = Layer.effectDiscard(prepareMigrations(options.migrations)).pipe(Layer.provideMerge(pool));
	const live = Layer.effect(changesService, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer));
	const base = Layer.merge(prepared, live);
	const changes = options.config?.changes;
	return Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			const hints = yield* changesService;
			const url = options.config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const name = yield* Config.String("APP_NAME").pipe(Config.withDefault(new URL(Redacted.value(url)).pathname));
			const channel = changes?.channel ?? `changes_${createHash("sha256").update(name).digest("hex").slice(0, 32)}`;
			return postgresChanges({ ...changes, channel, client, resync: hints.resync });
		}),
	).pipe(Layer.provideMerge(base));
}

function prepareMigrations<R>(migrations: AppDatabaseOptions<R>["migrations"]) {
	switch (migrations.mode) {
		case "check":
			return assertPostgresMigrations(migrations);
		case "wait":
			return waitForMigrations(migrations);
		default:
			return migratePostgres({ ...migrations, lockTimeout: migrations.lockTimeout ?? "5 seconds" });
	}
}

function waitForMigrations<R>(migrations: AppDatabaseOptions<R>["migrations"]) {
	return assertPostgresMigrations(migrations).pipe(
		Effect.retry({
			schedule: Schedule.max([Schedule.spaced(migrations.pollInterval ?? "1 second"), Schedule.during(migrations.waitTimeout ?? "5 minutes")]),
			while: (error) => error._tag === "MigrationError" && error.kind === "BadState",
		}),
	);
}

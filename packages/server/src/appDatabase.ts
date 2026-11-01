import { createHash } from "node:crypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Config, Context, Duration, Effect, Fiber, Layer, Option, Redacted, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator } from "effect/sql";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { assertPostgresMigrations, postgresMigrationError } from "@shivaedev/sql/assertPostgresMigrations.ts";
import { coordinateWorkerRelease } from "@shivaedev/sql/coordinateWorkerRelease.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { type PendingPostgresMigrations, pendingPostgresMigrations } from "@shivaedev/sql/pendingPostgresMigrations.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/sql/postgresChanges.ts";
import { type PostgresOptions, postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import type { AppDatabaseOptions } from "#appHost.ts";

export interface DatabaseConfig extends PostgresOptions {
	readonly changes?: Partial<Omit<PostgresChangesOptions, "client" | "listenerClient" | "connectionSetting" | "connectionTTL" | "resync">>;
	readonly clock?: Clock.Clock;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly listenDatabaseUrl?: Redacted.Redacted<string>;
}

export function appDatabase<R, E = never>(options: AppDatabaseOptions<R, E>) {
	const config = {
		...options.config,
		"connectionTTL": options.config?.connectionTTL ?? "10 minutes",
		idleTimeout: options.config?.idleTimeout ?? "1 minute",
	} satisfies DatabaseConfig;
	const clock = Layer.succeed(Clock.Clock, config.clock ?? Clock.Clock.defaultValue());
	const pool = Layer.unwrap(
		Effect.map(options.config?.databaseUrl === undefined ? Config.Redacted("DATABASE_URL") : Effect.succeed(options.config.databaseUrl), (url) =>
			postgresLayer(url, config).pipe(Layer.provide(clock)),
		),
	);
	const live = LiveServer.layer.pipe(Layer.provideMerge(Reactivity.layer));
	const migrations = options.migrations;
	const worker =
		migrations.mode === "wait" && migrations.release !== undefined
			? Layer.effect(WorkerRelease, coordinateWorkerRelease(migrations.release, migrations.pollInterval, migrations.table))
			: Layer.empty;
	const base = Layer.merge(pool, live);
	const changes = options.config?.changes;
	const connected = Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			const hints = yield* LiveServer;
			const url = options.config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const name = yield* Config.String("APP_NAME").pipe(Config.withDefault(new URL(Redacted.value(url)).pathname));
			const channel = changes?.channel ?? `changes_${createHash("sha256").update(name).digest("hex").slice(0, 32)}`;
			const listenUrl = options.config?.listenDatabaseUrl ?? Option.getOrUndefined(yield* Config.Redacted("LISTEN_DATABASE_URL").pipe(Config.option));
			const listenerClient =
				listenUrl === undefined
					? client
					: yield* Effect.map(
							Layer.build(postgresLayer(listenUrl, { ...config, maxConnections: 1, minConnections: 0 }).pipe(Layer.provide(clock))),
							(context) => Context.get(context, PgClient.PgClient),
						);
			let connectionSetting = options.config?.databaseUrl === undefined ? "DATABASE_URL" : "config.databaseUrl";
			if (listenUrl !== undefined) {
				connectionSetting = options.config?.listenDatabaseUrl === undefined ? "LISTEN_DATABASE_URL" : "config.listenDatabaseUrl";
			}
			return postgresChanges({
				...changes,
				channel,
				client,
				connectionSetting,
				"connectionTTL": config.connectionTTL,
				listenerClient,
				resync: hints.resync(),
			}).pipe(Layer.provide(clock));
		}),
	).pipe(Layer.provideMerge(base));
	const prepared = Layer.effectDiscard(prepareMigrations(migrations)).pipe(Layer.provideMerge(connected));
	return worker.pipe(Layer.provideMerge(prepared));
}

function prepareMigrations<R, E>(migrations: AppDatabaseOptions<R, E>["migrations"]) {
	switch (migrations.mode) {
		case "check": {
			const { release: _release, ...schema } = migrations;
			return assertPostgresMigrations(schema);
		}
		case "wait":
			return waitForMigrations(migrations);
		default:
			return migratePostgres({ ...migrations, lockTimeout: migrations.lockTimeout ?? "5 seconds" }).pipe(Effect.asVoid);
	}
}

function waitForMigrations<R, E>(migrations: AppDatabaseOptions<R, E>["migrations"]) {
	return Effect.gen(function* () {
		const progressInterval = Duration.fromInputUnsafe(migrations.progressInterval ?? "30 seconds");
		let pending: PendingPostgresMigrations = { components: [], migrations: [] };
		let progress: Fiber.Fiber<never> | undefined;
		function log(message: string) {
			return Effect.suspend(() =>
				Effect.logInfo(message).pipe(Effect.annotateLogs({ pendingComponents: pending.components, pendingMigrations: pending.migrations })),
			);
		}
		yield* Effect.gen(function* () {
			pending = yield* pendingPostgresMigrations(migrations);
			if (pending.migrations.length === 0 && pending.components.length === 0) {
				return;
			}
			if (progress === undefined) {
				yield* log("Waiting for database migrations");
				progress = yield* Effect.forever(Effect.sleep(progressInterval).pipe(Effect.andThen(log("Still waiting for database migrations")))).pipe(
					Effect.forkScoped,
				);
			}
			return yield* Effect.fail(postgresMigrationError(pending));
		}).pipe(
			Effect.retry({
				schedule: Schedule.max([Schedule.spaced(migrations.pollInterval ?? "1 second"), Schedule.during(migrations.waitTimeout ?? "5 minutes")]),
				while: (error) => error instanceof Migrator.MigrationError && error.kind === "BadState",
			}),
			Effect.tapError((error) =>
				error instanceof Migrator.MigrationError && error.kind === "BadState" ? log("Timed out waiting for database migrations") : Effect.void,
			),
		);
		if (progress !== undefined) {
			yield* Fiber.interrupt(progress);
			yield* Effect.logInfo("Database migrations current");
		}
	}).pipe(Effect.scoped);
}

import { createHash } from "node:crypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Duration, Effect, Fiber, Layer, Option, Redacted, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { Migrator } from "effect/sql";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { assertPostgresMigrations, postgresMigrationError } from "@shivaedev/sql/assertPostgresMigrations.ts";
import type { SqlNameTransforms } from "@shivaedev/sql/clientOptions.ts";
import { coordinateWorkerRelease } from "@shivaedev/sql/coordinateWorkerRelease.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { type PendingPostgresMigrations, pendingPostgresMigrations } from "@shivaedev/sql/pendingPostgresMigrations.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/sql/postgresChanges.ts";
import { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import { postgresClient } from "#adapters/postgresClient.ts";
import type { AppChanges, AppDatabaseOptions } from "#appHost.ts";

export interface DatabaseConfig extends SqlNameTransforms {
	readonly applicationName?: string;
	readonly changes?: Partial<Omit<PostgresChangesOptions, "client" | "listenerClient" | "connectionSetting" | "resync">>;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly listenDatabaseUrl?: Redacted.Redacted<string>;
	readonly maxConnections?: number;
}

export function databaseLayer<R, E>(options: AppDatabaseOptions<R, E>, changesService: typeof AppChanges) {
	const pool = Layer.unwrap(
		Effect.map(options.config?.databaseUrl === undefined ? Config.Redacted("DATABASE_URL") : Effect.succeed(options.config.databaseUrl), (url) =>
			PgClient.layerFrom(postgresClient(url, options.config)),
		),
	);
	const prepared = Layer.effectDiscard(prepareMigrations(options.migrations)).pipe(Layer.provideMerge(pool));
	const live = Layer.effect(changesService, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer));
	const migrations = options.migrations;
	const worker =
		migrations.mode === "wait" && migrations.release !== undefined
			? Layer.effect(WorkerRelease, coordinateWorkerRelease(migrations.release, migrations.pollInterval, migrations.table))
			: Layer.empty;
	const base = Layer.merge(worker.pipe(Layer.provideMerge(prepared)), live);
	const changes = options.config?.changes;
	return Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			const hints = yield* changesService;
			const url = options.config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const name = yield* Config.String("APP_NAME").pipe(Config.withDefault(new URL(Redacted.value(url)).pathname));
			const channel = changes?.channel ?? `changes_${createHash("sha256").update(name).digest("hex").slice(0, 32)}`;
			const listenUrl = options.config?.listenDatabaseUrl ?? Option.getOrUndefined(yield* Config.Redacted("LISTEN_DATABASE_URL").pipe(Config.option));
			const listenerClient =
				listenUrl === undefined ? client : yield* postgresClient(listenUrl, { applicationName: options.config?.applicationName, maxConnections: 1 });
			let connectionSetting = options.config?.databaseUrl === undefined ? "DATABASE_URL" : "config.databaseUrl";
			if (listenUrl !== undefined) {
				connectionSetting = options.config?.listenDatabaseUrl === undefined ? "LISTEN_DATABASE_URL" : "config.listenDatabaseUrl";
			}
			return postgresChanges({ ...changes, channel, client, connectionSetting, listenerClient, resync: hints.resync });
		}),
	).pipe(Layer.provideMerge(base));
}

function prepareMigrations<R, E>(migrations: AppDatabaseOptions<R, E>["migrations"]) {
	switch (migrations.mode) {
		case "check": {
			const schema = { ...migrations };
			delete schema.release;
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

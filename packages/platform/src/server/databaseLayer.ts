import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Duration, Effect, Fiber, Layer, Redacted, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { assertPostgresMigrations, postgresMigrationError } from "@shivaedev/sql/assertPostgresMigrations.ts";
import type { SqlNameTransforms } from "@shivaedev/sql/clientOptions.ts";
import { coordinateWorkerRelease } from "@shivaedev/sql/coordinateWorkerRelease.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { type PendingPostgresMigrations, pendingPostgresMigrations } from "@shivaedev/sql/pendingPostgresMigrations.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/sql/postgresChanges.ts";
import { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
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
			const address = databaseAddress(url);
			const disconnected = new Set<Promise<void>>();
			// Native pool shutdown sends Terminate without waiting for its sockets to close.
			yield* Effect.addFinalizer(() => Effect.promise(() => Promise.all([...disconnected])));
			return PgClient.layer({
				stream: () => {
					const target = new URL(Redacted.value(url));
					const host = address.host ?? target.searchParams.getAll("host").at(-1) ?? (decodeURIComponent(target.hostname) || "localhost");
					const port = address.port ?? 5432;
					const socket = createConnection(host.startsWith("/") ? { path: `${host}/.s.PGSQL.${port}` } : { host, noDelay: true, port });
					const closed = new Promise<void>((resolve) =>
						socket.once("close", () => {
							disconnected.delete(closed);
							resolve();
						}),
					);
					disconnected.add(closed);
					return socket;
				},
				transformQueryNames: options.config?.transformQueryNames,
				transformResultNames: options.config?.transformResultNames,
				url,
				...address,
				...(options.config?.maxConnections === undefined ? {} : { maxConnections: options.config.maxConnections }),
				...(options.config?.applicationName === undefined ? {} : { applicationName: options.config.applicationName }),
			});
		}),
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
			return postgresChanges({ ...changes, channel, client, resync: hints.resync });
		}),
	).pipe(Layer.provideMerge(base));
}

function prepareMigrations<R>(migrations: AppDatabaseOptions<R>["migrations"]) {
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

function waitForMigrations<R>(migrations: AppDatabaseOptions<R>["migrations"]) {
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
				while: (error) => error._tag === "MigrationError" && error.kind === "BadState",
			}),
			Effect.tapError((error) =>
				error._tag === "MigrationError" && error.kind === "BadState" ? log("Timed out waiting for database migrations") : Effect.void,
			),
		);
		if (progress !== undefined) {
			yield* Fiber.interrupt(progress);
			yield* Effect.logInfo("Database migrations current");
		}
	}).pipe(Effect.scoped);
}

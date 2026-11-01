import { Cause, Clock, Deferred, type Duration, Effect, Exit, Option } from "effect";
import { Migrator } from "effect/sql";
import { assertPostgresMigrations } from "#assertPostgresMigrations.ts";
import { migratePostgres } from "#migrations.ts";
import { pendingPostgresMigrations } from "#pendingPostgresMigrations.ts";
import { readPostgresRelease } from "#postgresRelease.ts";
import { type ComponentName, componentOf, described, loaderOf, type Migration } from "./migrationCatalog.ts";
import { migrationConcurrency } from "./migrationConcurrency.ts";
import type { Applied, MigrationEngine } from "./migrationEngine.ts";
import { failureOf, outcomeOf } from "./outcome.ts";

export interface RunOptions {
	readonly components?: readonly ComponentName[];
	readonly lockTimeout?: Duration.Input;
	readonly release?: string;
}

const TABLES = ["audit", "ledger", "orders", "release", "workers"] as const;

export function runOutcome(exit: Exit.Exit<unknown, unknown>): string {
	const failure = Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : Option.none();
	if (Option.isSome(failure) && failure.value instanceof Migrator.MigrationError && failure.value.cause !== undefined) {
		return `${outcomeOf(exit)}, caused by ${failureOf(failure.value.cause)}`;
	}
	return outcomeOf(exit);
}

function withOptions(options: RunOptions) {
	const parts = [
		...(options.components === undefined ? [] : [`schema components ${options.components.join(", ")}`]),
		...(options.release === undefined ? [] : [`release ${options.release}`]),
		...(options.lockTimeout === undefined ? [] : [`a lock timeout of ${String(options.lockTimeout)}`]),
	];
	return parts.length === 0 ? "" : ` with ${parts.join(" and ")}`;
}

export function migrationVerbs(engine: MigrationEngine, tell: (line: string) => void) {
	const { sql, tables } = engine;
	function optionsOf(migrations: readonly Migration[], options: RunOptions) {
		return {
			components: (options.components ?? []).map((name) => componentOf(engine, name)),
			loader: loaderOf(engine, migrations),
			lockTimeout: options.lockTimeout ?? "5 seconds",
			table: tables.ledger,
			...(options.release === undefined ? {} : { release: options.release }),
		};
	}
	function run(migrations: readonly Migration[], options: RunOptions, pauseLoader = false) {
		return Effect.gen(function* () {
			engine.firstRunStarted.at ??= yield* Clock.currentTimeMillis;
			const configured = optionsOf(migrations, options);
			const loader = pauseLoader
				? Deferred.succeed(engine.pause.entered, undefined).pipe(
						Effect.andThen(Deferred.await(engine.pause.resume)),
						Effect.andThen(configured.loader),
					)
				: configured.loader;
			const exit = yield* Effect.exit(migratePostgres({ ...configured, loader }));
			return Exit.isSuccess(exit) ? exit.value : runOutcome(exit);
		});
	}
	return {
		...migrationConcurrency(engine, tell, run),
		assertReady: (migrations: readonly Migration[], options: RunOptions = {}) =>
			Effect.gen(function* () {
				tell(`a service checks readiness for ${described(migrations)}${withOptions(options)}`);
				const exit = yield* Effect.exit(assertPostgresMigrations(optionsOf(migrations, options)));
				const verdict = Exit.isSuccess(exit) ? "ready" : runOutcome(exit);
				engine.verdicts.push(verdict);
				return verdict;
			}),
		bodiesRun: () => Effect.sync(() => [...engine.bodiesRun]),
		existingTables: () =>
			Effect.gen(function* () {
				const names = {
					audit: tables.audit,
					ledger: tables.ledger,
					orders: tables.orders,
					release: `${tables.ledger}_release`,
					workers: `${tables.ledger}_workers`,
				};
				const present: string[] = [];
				for (const table of TABLES) {
					const [row] = yield* sql<{ readonly name: string | null }>`select to_regclass(${names[table]})::text as name`;
					if (row?.name !== null && row !== undefined) {
						present.push(table);
					}
				}
				return present;
			}).pipe(Effect.orDie),
		ledger: () =>
			Effect.gen(function* () {
				const [exists] = yield* sql<{ readonly name: string | null }>`select to_regclass(${tables.ledger})::text as name`;
				if (exists?.name === null || exists === undefined) {
					return "no ledger";
				}
				const rows = yield* sql<{
					readonly id: number;
					readonly name: string;
				}>`select migration_id as id, name from ${sql(tables.ledger)} order by migration_id`.withoutTransform;
				return rows.map(({ id, name }) => [id, name] as const);
			}).pipe(Effect.orDie),
		lockTimeoutsSeen: () => Effect.sync(() => [...engine.lockTimeouts]),
		loggedErrors: () =>
			Effect.sync(() =>
				engine.logs.filter(({ level }) => level === "Error").map(({ cause, message }) => `${String(message)} ${cause.split("\n")[0] ?? ""}`),
			),
		migrate: (migrations: readonly Migration[], options: RunOptions = {}) =>
			Effect.suspend(() => {
				tell(`a runner migrates ${described(migrations)}${withOptions(options)}`);
				return Effect.tap(run(migrations, options), (outcome) => Effect.sync(() => engine.runs.push(outcome)));
			}),
		orders: () =>
			Effect.map(sql<{ readonly name: string }>`select name from ${sql(tables.orders)} order by name`, (rows) => rows.map(({ name }) => name)).pipe(
				Effect.orDie,
			),
		pendingWork: (migrations: readonly Migration[], options: RunOptions = {}) =>
			Effect.suspend(() => {
				tell(`a service reads the pending work for ${described(migrations)}${withOptions(options)}`);
				return pendingPostgresMigrations(optionsOf(migrations, options));
			}).pipe(Effect.orDie),
		recordedRelease: () => Effect.map(readPostgresRelease(tables.ledger), (marker) => marker?.release ?? "none").pipe(Effect.orDie),
		releaseMarker: () =>
			Effect.gen(function* () {
				const marker = yield* readPostgresRelease(tables.ledger);
				const now = yield* Clock.currentTimeMillis;
				const release = sql(`${tables.ledger}_release`);
				const [column] = yield* sql<{ readonly type: string }>`select pg_typeof(recorded_at)::text as type from ${release}`;
				const [count] = yield* sql<{ readonly rows: number }>`select count(*)::integer as rows from ${release}`;
				const recordedAt = marker?.recordedAt.getTime() ?? Number.NaN;
				return {
					columnType: column?.type,
					recordedDuringTheRuns: recordedAt >= (engine.firstRunStarted.at ?? now) && recordedAt <= now,
					release: marker?.release,
					rows: count?.rows,
				};
			}).pipe(Effect.orDie),
		releasesSeenByComponents: () => Effect.sync(() => [...engine.releasesSeenByComponents]),
		runs: () => Effect.sync((): ReadonlyArray<Applied | string> => [...engine.runs]),
		verdicts: () => Effect.sync(() => [...engine.verdicts]),
	};
}

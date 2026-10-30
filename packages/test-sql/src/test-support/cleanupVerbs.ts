import { Clock, Context, Deferred, Effect, Exit, Fiber, Layer, Redacted, Schedule, Scope, type Tracer } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import * as TestClock from "effect/testing/TestClock";
import { PostgresTestDatabase } from "#database.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

interface CleanupState {
	cloneScope: Scope.Closeable;
	engine: DatabaseEngine;
	leftovers: string[];
	name: string;
}

export function cleanupVerbs(state: CleanupState) {
	const { engine } = state;
	const admin = engine.admin;
	function role() {
		return new URL(Redacted.value(engine.options.url)).username;
	}
	let closed: Fiber.Fiber<void> | undefined;
	let unlock: Effect.Effect<unknown, SqlError> = Effect.void;
	function readDatabase() {
		return admin<{ datname: string }>`select datname from pg_database where datname = ${state.name}`;
	}
	const spans: Tracer.Span[] = [];
	function openClone(clock: "live" | "test" = "live") {
		return Effect.gen(function* () {
			const testClock = clock === "test" ? yield* TestClock.make() : undefined;
			if (testClock !== undefined) {
				yield* Effect.addFinalizer(() => testClock.adjust("1 minute"));
			}
			const open = engine.run(
				Effect.gen(function* () {
					const database = yield* PostgresTestDatabase;
					const context = yield* database.isolated.pipe(Effect.provideService(Scope.Scope, state.cloneScope));
					state.name = new URL(Redacted.value(Context.get(context, PostgresTestDatabase).url)).pathname.slice(1);
					yield* Effect.addFinalizer(() =>
						Scope.close(state.cloneScope, Exit.void).pipe(
							Effect.ensuring(Effect.orDie(admin`drop database if exists ${admin(state.name)} with (force)`)),
						),
					);
				}),
			);
			return yield* testClock === undefined ? open : open.pipe(Effect.provideService(Clock.Clock, testClock));
		});
	}

	return {
		awaitCleanup: () =>
			Effect.andThen(
				closed === undefined ? Effect.void : Fiber.join(closed),
				engine.run(Effect.flatMap(PostgresTestDatabase, (database) => database.awaitCleanup)),
			),
		closeClone: () =>
			Effect.gen(function* () {
				const tracer = yield* Effect.tracer;
				closed = yield* Scope.close(state.cloneScope, Exit.void).pipe(
					Effect.withTracer({
						span(options) {
							const span = tracer.span(options);
							spans.push(span);
							return span;
						},
					}),
					Effect.forkScoped,
				);
				yield* Effect.addFinalizer(() => unlock.pipe(Effect.orDie));
			}),
		closeRun: () => Effect.andThen(closed === undefined ? Effect.void : Fiber.join(closed), engine.close()),
		closeRunExit: () => Effect.andThen(closed === undefined ? Effect.void : Fiber.join(closed), engine.close()).pipe(Effect.exit),
		denyDrop: () =>
			Effect.gen(function* () {
				yield* Effect.addFinalizer(() => Effect.orDie(admin`drop database if exists ${admin(state.name)} with (force)`));
				yield* admin`alter database ${admin(state.name)} owner to postgres`;
			}),
		exhaustBudget: () =>
			Effect.gen(function* () {
				yield* Effect.addFinalizer(() => Effect.orDie(admin`alter role ${admin(role())} connection limit 2`));
				yield* admin`alter role ${admin(role())} connection limit 0`;
			}),
		// Cleanup stories close scopes and inspect background drops while this catalog lock remains held.
		holdDrops: () =>
			Effect.gen(function* () {
				const ready = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const fiber = yield* admin
					.withTransaction(
						Effect.gen(function* () {
							yield* admin`lock table pg_database in share mode`;
							yield* Deferred.succeed(ready, undefined);
							yield* Deferred.await(release);
						}),
					)
					.pipe(Effect.forkScoped);
				unlock = Effect.andThen(Deferred.succeed(release, undefined), Fiber.join(fiber));
				yield* Deferred.await(ready);
			}),
		openClone,
		readCloneScopeExit: () => Effect.sync(() => closed?.pollUnsafe()),
		readDatabase,
		readLeftoverDatabases: () => admin<{ datname: string }>`select datname from pg_database where ${admin.in("datname", state.leftovers)}`,
		readLeftoverNames: () => Effect.sync(() => state.leftovers),
		readName: () => Effect.sync(() => state.name),
		releaseDrops: () => unlock,
		restoreBudget: () => admin`alter role ${admin(role())} connection limit 2`,
		startAnotherRun: () => Effect.scoped(Layer.build(engine.fixture.layer)),
		waitForDatabaseRemoval: () =>
			readDatabase().pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: (rows) => rows.length > 0 }), Effect.timeout("5 seconds")),
		waitForDrop: () =>
			admin`select 1 from pg_stat_activity where query like ${`drop database%${state.name}%`} and wait_event_type = 'Lock'`.pipe(
				Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: (rows) => rows.length === 0 }),
				Effect.timeout("5 seconds"),
			),
		waitForFailedDrop: () =>
			Effect.sync(() =>
				spans.flatMap((span) => {
					const status = span.status;
					return span.name === "PostgresTest.administer" && status._tag === "Ended" && Exit.isFailure(status.exit) ? [status.exit.cause.reasons] : [];
				}),
			).pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: (failures) => failures.length === 0 }), Effect.timeout("5 seconds")),
	};
}

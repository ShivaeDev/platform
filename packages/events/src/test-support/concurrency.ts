import { Deferred, Effect, Fiber, Result } from "effect";
import { SqlClient } from "effect/sql";
import { transact } from "@shivaedev/sql/transact.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import { AlreadyDone, StreamConflict } from "#errors.ts";
import type { NoteEngine } from "./notes.ts";

export function outcome<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.map(() => "appended"),
		Effect.catch((error) => {
			if (error instanceof AlreadyDone) {
				return Effect.succeed("already done");
			}
			if (error instanceof StreamConflict) {
				return Effect.succeed(`conflict at ${error.actualVersion}, expected ${error.expectedVersion}`);
			}
			return Effect.fail(error);
		}),
	);
}

export const writersRace = Effect.fnUntraced(function* (engine: NoteEngine, repeated: boolean) {
	const sql = yield* SqlClient.SqlClient;
	const results = yield* raceWithLock({
		clock: "test",
		effects: ["alice", "bob"].map((name) =>
			outcome(
				engine.store.append({
					events: [{ name }],
					expectedVersion: 0,
					requestId: repeated ? "same-request" : name,
					stream: "shared",
				}),
			),
		),
		lock: sql`lock table events_requests in share mode`,
	});
	return yield* Effect.forEach(results, (result) => (Result.isSuccess(result) ? Effect.succeed(result.success) : Effect.fail(result.failure))).pipe(
		Effect.map((endings) => endings.sort()),
	);
});

export const holdEarlyCommit = Effect.fnUntraced(function* (engine: NoteEngine) {
	const appended = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const writer = yield* transact(
		Effect.gen(function* () {
			yield* engine.history.append({ events: [{ name: "Early" }], expectedVersion: 0, requestId: "early", stream: "alpha" });
			yield* Deferred.succeed(appended, undefined);
			yield* Deferred.await(release);
		}),
		{ onSqlError: (error) => error },
	).pipe(Effect.forkScoped);
	yield* Effect.raceFirst(Deferred.await(appended), Fiber.join(writer).pipe(Effect.andThen(Effect.never))).pipe(Effect.timeout("5 seconds"));
	return () => Deferred.succeed(release, undefined).pipe(Effect.andThen(Fiber.join(writer)));
});

export const raceRebuildAndCatchUp = Effect.fnUntraced(function* (engine: NoteEngine) {
	const sql = yield* SqlClient.SqlClient;
	const entered = yield* Deferred.make<number>();
	const release = yield* Deferred.make<void>();
	engine.resetPause.current = { entered, release };
	const rebuilding = yield* engine.store.rebuild.pipe(Effect.forkScoped);
	const pid = yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(rebuilding).pipe(Effect.andThen(Effect.never))).pipe(
		Effect.timeout("5 seconds"),
	);
	const consuming = yield* engine.store.catchUp.pipe(Effect.forkScoped);
	const waiting = sql<{ waiting: boolean }>`select exists (
		select 1 from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))
		and query like '%select version from events_streams%'
	) as waiting`.pipe(Effect.map(([row]) => row?.waiting ?? false));
	const ending = yield* Effect.raceFirst(
		observeUntil(waiting, (blocked) => blocked, "catch-up to wait for rebuild", { clock: "test" }).pipe(Effect.as("waited for rebuild")),
		Fiber.join(consuming).pipe(Effect.as("finished before rebuild committed")),
	);
	yield* Deferred.succeed(release, undefined);
	yield* Fiber.join(rebuilding);
	yield* Fiber.join(consuming);
	return ending;
});

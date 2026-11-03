import { Cause, Clock, Deferred, type Duration, Effect, Exit, Queue, Scope, SubscriptionRef } from "effect";
import { TestClock } from "effect/testing";
import { changes } from "@shivaedev/sql/changes.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { type Engine, open, tasks, waitForFailure, workerByName } from "#test/engine.ts";

export function verbs(engine: Engine) {
	function edit(title: string, rollback = false) {
		return Effect.gen(function* () {
			yield* engine.sql`update tasks set title = ${title} where id = 1`;
			yield* changes({ tasks: [tasks.item(1)] }).record();
			if (rollback) {
				return yield* Effect.fail("rolled back");
			}
		}).pipe(transact({ onSqlError: (error) => error }));
	}
	return {
		advance: (duration: Duration.Input) => TestClock.adjust(duration),
		break: (name: string, kind: "defect" | "typed" = "defect") =>
			Effect.sync(() => {
				workerByName(engine, name).failure = kind;
			}),
		clearDue: () =>
			Effect.gen(function* () {
				yield* engine.sql`update tasks set due = null where id = 1`;
				yield* changes({ tasks: [tasks.item(1)] }).record();
			}).pipe(transact({ onSqlError: (error) => error })),
		close: (name: string) => Scope.close(workerByName(engine, name).scope, Exit.void),
		commit: (title: string) => edit(title),
		dueIn: (millis: number) =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				yield* engine.sql`update tasks set due = ${now + millis} where id = 1`;
				yield* changes({ tasks: [tasks.item(1)] }).record();
			}).pipe(transact({ onSqlError: (error) => error })),
		failed: (name: string) => waitForFailure(workerByName(engine, name)),
		failure: (name: string) =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(workerByName(engine, name).handle.await);
				if (Exit.isSuccess(exit)) {
					return "ended";
				}
				return Cause.pretty(exit.cause);
			}),
		interrupted: (name: string) =>
			Effect.map(Effect.exit(workerByName(engine, name).handle.await), (exit) => Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)),
		loseFailureStorage: () => engine.sql`drop table failures`,
		passes: (name: string) => Effect.sync(() => workerByName(engine, name).passes),
		queries: (name: string) => Effect.sync(() => workerByName(engine, name).reads.map((rows) => rows.map((row) => row.title))),
		recover: (name: string) =>
			Effect.sync(() => {
				workerByName(engine, name).failure = undefined;
			}),
		refresh: (name: string) => workerByName(engine, name).handle.refresh,
		release: (name: string) =>
			Effect.suspend(() => {
				const value = workerByName(engine, name);
				const gate = value.gate;
				value.gate = undefined;
				return gate === undefined ? Effect.void : Deferred.succeed(gate, undefined).pipe(Effect.asVoid);
			}),
		releaseRead: (name: string) =>
			Effect.suspend(() => {
				const value = workerByName(engine, name);
				const gate = value.readGate;
				value.readGate = undefined;
				return gate === undefined ? Effect.void : Deferred.succeed(gate, undefined).pipe(Effect.asVoid);
			}),
		resume: (name: string) => workerByName(engine, name).handle.resume,
		rollback: (title: string) =>
			edit(title, true).pipe(
				Effect.catchIf(
					(error) => error === "rolled back",
					() => Effect.void,
				),
			),
		settled: (name: string) => Queue.take(workerByName(engine, name).settled),
		start: (name: string) => open(engine, name),
		startBlocked: (name: string) => open(engine, name, { blocked: true }),
		startReading: (name: string) => open(engine, name, { readBlocked: true }),
		state: (name: string) => SubscriptionRef.get(workerByName(engine, name).handle.state),
		storedFailures: () => engine.sql<{ name: string; cause: string }>`select name, cause from failures order by name`,
		typedFailure: (name: string) =>
			workerByName(engine, name).handle.await.pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => "ended" })),
	};
}

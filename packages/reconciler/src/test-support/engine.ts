import { Cause, Context, Deferred, Effect, Queue, Schema, Scope, Stream, SubscriptionRef } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { collection, type Key } from "@shivaedev/changes/keys.ts";
import type { Reconciler } from "#Reconciler.ts";
import { run } from "#run.ts";

export const tasks = collection("tasks", Schema.Int, { title: Schema.String });
export interface Task {
	readonly due: number | null;
	readonly id: number;
	readonly title: string;
}
class WorkerName extends Context.Service<WorkerName, string>()("@shivaedev/reconciler/test/WorkerName") {}
export interface Worker {
	readonly entered: Queue.Queue<void>;
	failure: "defect" | "typed" | undefined;
	gate: Deferred.Deferred<void> | undefined;
	readonly handle: Reconciler<SqlError | string>;
	readonly passes: string[][];
	readonly readEntered: Queue.Queue<void>;
	readGate: Deferred.Deferred<void> | undefined;
	readonly reads: Task[][];
	readonly scope: Scope.Closeable;
	readonly settled: Queue.Queue<void>;
}

export const makeEngine = Effect.gen(function* () {
	return { sql: yield* SqlClient.SqlClient, workers: new Map<string, Worker>() };
});
export type Engine = Effect.Success<typeof makeEngine>;

export const open = Effect.fnUntraced(function* (
	engine: Engine,
	name: string,
	options: { blocked?: boolean; readBlocked?: boolean; keys?: readonly Key[] } = {},
) {
	const entered = yield* Queue.unbounded<void>();
	const settled = yield* Queue.unbounded<void>();
	const readEntered = yield* Queue.unbounded<void>();
	const passes: string[][] = [];
	const reads: Task[][] = [];
	const gate = options.blocked ? yield* Deferred.make<void>() : undefined;
	const readGate = options.readBlocked ? yield* Deferred.make<void>() : undefined;
	const scope = yield* Scope.fork(yield* Effect.scope);
	let worker: Worker;
	const handle = yield* run({
		act: (rows) =>
			Effect.gen(function* () {
				const workerName = yield* WorkerName;
				passes.push(rows.map((row) => row.title));
				yield* Queue.offer(entered, undefined);
				if (worker.gate !== undefined) {
					yield* Deferred.await(worker.gate);
				}
				if (worker.failure === "defect") {
					return yield* Effect.die(new Error(`${workerName} broke`));
				}
				if (worker.failure === "typed") {
					return yield* Effect.fail(`${workerName} refused`);
				}
			}),
		due: (rows) => {
			const times = rows.flatMap((row) => (row.due === null ? [] : [row.due]));
			return times.length === 0 ? undefined : Math.min(...times);
		},
		keys: options.keys ?? [tasks.list],
		onFailure: (cause) => engine.sql`insert into failures (name, cause) values (${name}, ${Cause.pretty(cause)})`,
		read: Effect.gen(function* () {
			const rows = yield* engine.sql<Task>`select id, title, due from tasks order by id`;
			reads.push([...rows]);
			yield* Queue.offer(readEntered, undefined);
			if (worker.readGate !== undefined) {
				yield* Deferred.await(worker.readGate);
			}
			return rows;
		}),
	}).pipe(Effect.provideService(WorkerName, name), Scope.provide(scope));
	worker = { entered, failure: undefined, gate, handle, passes, readEntered, readGate, reads, scope, settled };
	engine.workers.set(name, worker);
	yield* SubscriptionRef.changes(handle.state).pipe(
		Stream.runForEach((state) => (state.status === "waiting" ? Queue.offer(settled, undefined).pipe(Effect.asVoid) : Effect.void)),
		Effect.forkScoped({ startImmediately: true }),
	);
	if (options.readBlocked) {
		yield* Queue.take(readEntered);
	} else if (options.blocked) {
		yield* Queue.take(entered);
	} else {
		yield* Queue.take(settled);
	}
});

export function workerByName(engine: Engine, name: string): Worker {
	const value = engine.workers.get(name);
	if (value === undefined) {
		throw new Error(`No worker named ${name}`);
	}
	return value;
}

export function waitForFailure(value: Worker) {
	return SubscriptionRef.changes(value.handle.state).pipe(
		Stream.filter((state) => state.status === "failed"),
		Stream.take(1),
		Stream.runDrain,
	);
}

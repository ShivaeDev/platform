import { Deferred, Effect, Queue, Stream, SubscriptionRef } from "effect";
import { changes } from "@shivaedev/sql/changes.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { each } from "#each.ts";
import { configured, database } from "#test/database.ts";
import { makeEngine, type Task, tasks } from "#test/engine.ts";

export const keyed = storyKit({
	around: withIsolatedDatabase,
	*create() {
		const { sql } = yield* makeEngine;
		const started = yield* Queue.unbounded<string>();
		const stopped = yield* Queue.unbounded<string>();
		const settled = yield* Queue.unbounded<void>();
		const gates = new Map<number, Deferred.Deferred<void>>();
		const handle = yield* each({
			act: (row: Task) =>
				Effect.gen(function* () {
					const gate = yield* Deferred.make<void>();
					gates.set(row.id, gate);
					yield* Effect.addFinalizer(() => Queue.offer(stopped, row.title).pipe(Effect.asVoid));
					yield* Queue.offer(started, row.title);
					yield* Deferred.await(gate);
					if (row.title === "broken") {
						return yield* Effect.die(new Error("keyed task broke"));
					}
				}),
			key: (row) => row.id,
			keys: [tasks.list],
			read: sql<Task>`select id, title, due from tasks order by id`,
		});
		yield* SubscriptionRef.changes(handle.state).pipe(
			Stream.runForEach((state) => (state.status === "waiting" ? Queue.offer(settled, undefined).pipe(Effect.asVoid) : Effect.void)),
			Effect.forkScoped({ startImmediately: true }),
		);
		return { gates, handle, settled, sql, started, stopped };
	},
	layer: database,
	name: "keyed PostgreSQL reconciliation",
	runIf: configured,
	stages: [],
	verbs: ({ gates, handle, settled, sql, started, stopped }) => ({
		add: (id: number, title: string) =>
			Effect.gen(function* () {
				yield* sql`insert into tasks (id, title) values (${id}, ${title})`;
				yield* changes({ tasks: [tasks.item(id)] }).record();
			}).pipe(transact({ onSqlError: (error) => error })),
		complete: (id: number) =>
			Effect.suspend(() => {
				const gate = gates.get(id);
				if (gate === undefined) {
					return Effect.die(`No task ${id}`);
				}
				return Deferred.succeed(gate, undefined);
			}),
		failed: () =>
			SubscriptionRef.changes(handle.state).pipe(
				Stream.filter((state) => state.status === "failed"),
				Stream.take(1),
				Stream.runDrain,
			),
		failure: () => SubscriptionRef.get(handle.state),
		refresh: () => handle.refresh,
		remove: (id: number) =>
			Effect.gen(function* () {
				yield* sql`delete from tasks where id = ${id}`;
				yield* changes({ tasks: [tasks.item(id)] }).record();
			}).pipe(transact({ onSqlError: (error) => error })),
		settled: () => Queue.take(settled),
		started: () => Queue.take(started),
		stopped: () => Queue.take(stopped),
		stoppedPair: () => Effect.map(Queue.takeN(stopped, 2), (values) => values.sort((a, b) => a.localeCompare(b))),
		unclaimedStarts: () => Queue.size(started),
	}),
});

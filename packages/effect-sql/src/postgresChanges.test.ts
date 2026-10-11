import { Effect, Exit } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { integration, onClient, onSqlError, secondPool } from "#test/postgres-transact.ts";
import { runNotify, waitFor } from "#test/postgresNotify.ts";
import { invalidateOnCommit, transact } from "#transact.ts";

integration("NOTIFY splits UTF-8 key batches and a payload error rolls back the write", () => {
	const payloads: string[] = [];
	const state = { connections: 0, muted: false, payloads, resyncs: 0 };
	return runNotify(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const reactivity = yield* Reactivity.Reactivity;
			const keys = Array.from({ length: 6 }, (_, index) => `${index}:${"é".repeat(1000)}`);
			const delivered: string[] = [];
			const cancel = reactivity.registerUnsafe(keys, () => delivered.push("changed"));
			yield* Effect.addFinalizer(() => Effect.sync(cancel));
			const table = `notify_rows_${crypto.randomUUID().replaceAll("-", "")}`;
			yield* Effect.acquireRelease(
				sql`create table ${sql(table)} (id integer primary key, parent integer references ${sql(table)} (id) deferrable initially deferred)`,
				() => Effect.orDie(sql`drop table ${sql(table)}`),
			);
			yield* Effect.andThen(sql`insert into ${sql(table)} values (1)`, invalidateOnCommit(keys)).pipe(transact({ onSqlError }));
			yield* waitFor(() => delivered.length === 6);
			expect(state.payloads).toHaveLength(2);
			expect(state.payloads.flatMap((payload) => JSON.parse(payload))).toEqual(keys);
			expect(state.payloads.every((payload) => new TextEncoder().encode(payload).length < 8000)).toBe(true);
			const oversized = yield* Effect.andThen(sql`insert into ${sql(table)} values (2)`, invalidateOnCommit(["é".repeat(4000)])).pipe(
				transact({ onSqlError }),
				Effect.exit,
			);
			expect(Exit.isFailure(oversized)).toBe(true);
			const invalid = yield* Effect.andThen(sql`insert into ${sql(table)} values (3)`, invalidateOnCommit([{ id: 1 }])).pipe(
				transact({ onSqlError }),
				Effect.exit,
			);
			expect(Exit.isFailure(invalid)).toBe(true);
			const commitFailure = yield* Effect.andThen(sql`insert into ${sql(table)} values (4, 99)`, invalidateOnCommit(keys)).pipe(
				transact({ onSqlError }),
				Effect.exit,
			);
			expect(Exit.isFailure(commitFailure)).toBe(true);
			expect(yield* sql`select id from ${sql(table)}`).toEqual([{ id: 1 }]);
			yield* Effect.sleep("200 millis");
			expect(delivered).toHaveLength(6);
			yield* invalidateOnCommit([keys[0]]);
			expect(delivered).toHaveLength(7);
		}),
		state,
	);
});

integration("a listener that silently stops delivering heartbeats resyncs and starts a fresh subscription", () => {
	const state = { connections: 0, muted: false, resyncs: 0 };
	return runNotify(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const reactivity = yield* Reactivity.Reactivity;
			let changes = 0;
			const cancel = reactivity.registerUnsafe(["orders:1"], () => {
				changes += 1;
			});
			yield* Effect.addFinalizer(() => Effect.sync(cancel));
			state.muted = true;
			yield* waitFor(() => state.resyncs >= 2);
			state.muted = false;
			yield* waitFor(() => state.connections >= 2 && state.resyncs >= 3);
			yield* Effect.andThen(sql`select 1`, invalidateOnCommit(["orders:1"])).pipe(transact({ onSqlError }));
			yield* waitFor(() => changes === 1);
		}),
		state,
	);
});

integration("the binding leaves another native SQL client's committed invalidations local", () =>
	runNotify(
		Effect.gen(function* () {
			const other = yield* secondPool;
			const reactivity = yield* Reactivity.Reactivity;
			let delivered = 0;
			const cancel = reactivity.registerUnsafe(["other:1"], () => {
				delivered += 1;
			});
			yield* Effect.addFinalizer(() => Effect.sync(cancel));
			yield* invalidateOnCommit(["other:1"]).pipe(transact({ onSqlError }), onClient(other));
			expect(delivered).toBe(1);
			yield* Effect.sleep("100 millis");
			expect(delivered).toBe(1);
		}),
	),
);

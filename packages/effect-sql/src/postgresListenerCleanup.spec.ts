import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { integration, onSqlError } from "#test/postgres-transact.ts";
import { runNotify, waitFor } from "#test/postgresNotify.ts";
import { invalidateOnCommit, transact } from "#transact.ts";

integration("stalled listener cleanup cannot delay resync, fresh connection or scope release", async () => {
	const gate = Promise.withResolvers<void>();
	let closing = 0;
	const state = {
		channel: "",
		cleanup: Effect.andThen(
			Effect.sync(() => {
				closing += 1;
			}),
			Effect.promise(() => gate.promise),
		),
		connections: 0,
		muted: false,
		resyncs: 0,
	};
	try {
		await runNotify(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const reactivity = yield* Reactivity.Reactivity;
				let changes = 0;
				const cancel = reactivity.registerUnsafe(["orders:1"], () => {
					changes += 1;
				});
				yield* Effect.addFinalizer(() => Effect.sync(cancel));
				const listeners = sql<{ pid: number }>`select pid from pg_stat_activity where query = ${`LISTEN "${state.channel}"`}`;
				const before = yield* listeners;
				expect(before).toHaveLength(1);
				state.muted = true;
				yield* waitFor(() => state.resyncs >= 2).pipe(Effect.timeout("2 seconds"));
				expect(state.connections).toBe(1);
				expect(closing).toBe(1);
				state.muted = false;
				yield* waitFor(() => state.connections >= 2 && state.resyncs >= 3);
				const after = yield* listeners;
				expect(after).toHaveLength(1);
				expect(after.some((row) => !before.some((previous) => previous.pid === row.pid))).toBe(true);
				expect(after.some((row) => before.some((previous) => previous.pid === row.pid))).toBe(false);
				yield* invalidateOnCommit(["orders:1"]).pipe(transact({ onSqlError }));
				yield* waitFor(() => changes === 1);
			}).pipe(Effect.onError(() => Effect.sync(() => gate.resolve()))),
			state,
		);
		expect(closing).toBe(2);
	} finally {
		gate.resolve();
	}
});

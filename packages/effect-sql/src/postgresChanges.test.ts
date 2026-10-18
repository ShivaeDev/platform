import { Effect, Result } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { waitFor } from "#test/postgresNotify.ts";
import { onClient, onSqlError, Unavailable } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasNotificationRows, hasObserverPool, listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"NOTIFY splits UTF-8 key batches and a payload error rolls back the write",
	[listeningForChanges(), hasNotificationRows()],
	function* ({ sql, transact, invalidateOnCommit, notifications, watchChanges, notificationTable }) {
		const { state } = notifications();
		const keys = Array.from({ length: 6 }, (_, index) => `${index}:${"é".repeat(1000)}`);
		const delivered = yield* watchChanges(keys);
		const table = notificationTable();
		yield* Effect.andThen(sql`insert into ${sql(table)} values (1)`, invalidateOnCommit(keys)).pipe(transact({ onSqlError }));
		yield* waitFor(() => delivered.length === 6);
		expect(state.payloads).toHaveLength(2);
		expect(state.payloads.flatMap((payload) => JSON.parse(payload))).toEqual(keys);
		expect(state.payloads.every((payload) => new TextEncoder().encode(payload).length < 8000)).toBe(true);
		const oversized = yield* Effect.andThen(sql`insert into ${sql(table)} values (2)`, invalidateOnCommit(["é".repeat(4000)])).pipe(
			transact({ onSqlError }),
			Effect.result,
		);
		expect(Result.isFailure(oversized) && oversized.failure).toBeInstanceOf(Unavailable);
		expect(Result.isFailure(oversized) && oversized.failure.reason).toContain("exceeds the NOTIFY payload limit");
		const invalid = yield* Effect.andThen(sql`insert into ${sql(table)} values (3)`, invalidateOnCommit([{ id: 1 }])).pipe(
			transact({ onSqlError }),
			Effect.result,
		);
		expect(Result.isFailure(invalid) && invalid.failure).toBeInstanceOf(Unavailable);
		expect(Result.isFailure(invalid) && invalid.failure.reason).toContain("must be strings or finite numbers");
		let commitError: SqlError | undefined;
		const commitFailure = yield* Effect.andThen(sql`insert into ${sql(table)} values (4, 99)`, invalidateOnCommit(keys)).pipe(
			transact({
				onSqlError: (error) => {
					commitError = error;
					return onSqlError(error);
				},
			}),
			Effect.result,
		);
		expect(Result.isFailure(commitFailure) && commitFailure.failure).toBeInstanceOf(Unavailable);
		expect(commitError).toMatchObject({
			_tag: "SqlError",
			reason: { _tag: "ConstraintError", cause: { code: "23503", table } },
		});
		expect(yield* sql`select id from ${sql(table)}`).toEqual([{ id: 1 }]);
		yield* Effect.sleep("200 millis");
		expect(delivered).toHaveLength(6);
		yield* invalidateOnCommit([keys[0]]);
		expect(delivered).toHaveLength(7);
	},
);

postgres.it(
	"a listener that silently stops delivering heartbeats resyncs and starts a fresh subscription",
	[listeningForChanges({ heartbeatInterval: "50 millis", heartbeatTimeout: "150 millis", retryDelay: "20 millis" })],
	function* ({ sql, transact, invalidateOnCommit, notifications, watchChanges }) {
		const { state } = notifications();
		const changes = yield* watchChanges(["orders:1"]);
		state.muted = true;
		yield* waitFor(() => state.resyncs >= 2);
		state.muted = false;
		yield* waitFor(() => state.connections >= 2 && state.resyncs >= 3);
		yield* Effect.andThen(sql`select 1`, invalidateOnCommit(["orders:1"])).pipe(transact({ onSqlError }));
		yield* waitFor(() => changes.length === 1);
	},
);

postgres.it(
	"the binding leaves another native SQL client's committed invalidations local",
	[listeningForChanges(), hasObserverPool()],
	function* ({ transact, invalidateOnCommit, watchChanges, observerPool }) {
		const other = observerPool();
		const delivered = yield* watchChanges(["other:1"]);
		yield* invalidateOnCommit(["other:1"]).pipe(transact({ onSqlError }), onClient(other));
		expect(delivered).toEqual(["other:1"]);
		yield* Effect.sleep("100 millis");
		expect(delivered).toEqual(["other:1"]);
	},
);

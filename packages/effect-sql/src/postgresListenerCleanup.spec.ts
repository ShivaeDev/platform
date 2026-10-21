import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { onSqlError } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"stalled listener cleanup cannot delay resync, a new listener or scope release",
	[
		listeningForChanges(
			{
				heartbeatInterval: "50 millis",
				heartbeatTimeout: "150 millis",
				retryDelay: "20 millis",
			},
			true,
		),
	],
	function* ({ sql, transact, invalidateOnCommit, notifications, watchChanges }) {
		const { state, closing, close, release } = notifications();
		const changes = yield* watchChanges(["orders:1"]);
		try {
			const listeners = sql<{
				pid: number;
			}>`select pid from pg_stat_activity where query = ${`LISTEN "${state.channel}"`}`;
			const originalListeners = yield* listeners;
			expect(originalListeners).toEqual([{ pid: expect.any(Number) }]);
			state.muted = true;
			yield* eventually(Effect.try(() => expect(state.resyncs).toBeGreaterThanOrEqual(2))).pipe(Effect.timeout("2 seconds"));
			const initialListenerCount = originalListeners.length;
			expect(state.connections).toBe(initialListenerCount);
			expect(closing()).toBe(initialListenerCount);
			state.muted = false;
			yield* eventually(
				Effect.try(() => {
					expect(state.connections).toBeGreaterThanOrEqual(2);
					expect(state.resyncs).toBeGreaterThanOrEqual(3);
				}),
			).pipe(Effect.timeout("5 seconds"));
			expect(yield* listeners).toEqual([{ pid: expect.any(Number) }]);
			yield* invalidateOnCommit(["orders:1"]).pipe(transact({ onSqlError }));
			yield* eventually(Effect.try(() => expect(changes).toEqual(["orders:1"]))).pipe(Effect.timeout("5 seconds"));
			yield* close;
			const closedListenerCount = 2;
			expect(closing()).toBe(closedListenerCount);
		} finally {
			release();
		}
	},
);

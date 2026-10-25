import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { withLive } from "@shivaedev/effect-test/withLive.ts";
import { onSqlError } from "#test/postgresTransact.ts";
import { postgres } from "#test/sqlStory.ts";
import { listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"stalled listener cleanup cannot delay resync, a new listener or scope release",
	[
		listeningForChanges(
			{
				heartbeatInterval: "1 hour",
				heartbeatTimeout: "150 millis",
				retryDelay: "20 millis",
			},
			true,
		),
	],
	function* ({ sql, transact, invalidateOnCommit, notifications, watchChanges, recordedLogs }) {
		const { state, close, release, nextMutedHeartbeat, nextListener, nextCleanup } = notifications();
		const changes = yield* watchChanges(["orders:1"]);
		try {
			const listeners = sql<{
				pid: number;
			}>`select pid from pg_stat_activity where query = ${`LISTEN "${state.channel}"`}`;
			const originalListeners = yield* listeners;
			expect(originalListeners).toEqual([{ pid: expect.any(Number) }]);
			state.muted = true;
			yield* TestClock.adjust("1 hour");
			yield* nextMutedHeartbeat;
			yield* TestClock.adjust("150 millis");
			yield* withLive(eventually(Effect.try(() => expect(state.resyncEvents).toEqual(["resync", "resync"]))).pipe(Effect.timeout("5 seconds")));
			yield* nextCleanup;
			expect(state.listenerOperations).toEqual(["listen", "cleanup"]);
			state.muted = false;
			yield* TestClock.adjust("150 millis");
			yield* withLive(
				eventually(
					Effect.try(() =>
						expect(recordedLogs()).toMatchObject([{ level: "Warn", message: ["PostgreSQL change listener lost; resynchronizing live streams"] }]),
					),
				).pipe(Effect.timeout("5 seconds")),
			);
			yield* TestClock.adjust("20 millis");
			yield* nextListener;
			yield* TestClock.adjust("50 millis");
			yield* withLive(
				eventually(Effect.try(() => expect(state.resyncEvents).toEqual(["resync", "resync", "resync"]))).pipe(Effect.timeout("5 seconds")),
			);
			expect(state.listenerOperations).toEqual(["listen", "cleanup", "listen"]);
			expect(yield* listeners).toEqual([{ pid: expect.any(Number) }]);
			yield* invalidateOnCommit(["orders:1"]).pipe(transact({ onSqlError }));
			yield* withLive(eventually(Effect.try(() => expect(changes).toEqual(["orders:1"]))).pipe(Effect.timeout("5 seconds")));
			const closingScope = yield* Effect.forkScoped(close);
			yield* nextCleanup;
			yield* TestClock.adjust("150 millis");
			yield* Fiber.join(closingScope);
			expect(state.listenerOperations).toEqual(["listen", "cleanup", "listen", "cleanup"]);
		} finally {
			release();
		}
	},
	{ clock: "test" },
);

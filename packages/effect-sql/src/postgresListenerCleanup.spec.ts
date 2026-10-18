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
			expect(yield* listeners).toHaveLength(1);
			state.muted = true;
			yield* eventually(Effect.try(() => expect(state.resyncs).toBeGreaterThanOrEqual(2))).pipe(Effect.timeout("2 seconds"));
			expect(state.connections).toBe(1);
			expect(closing()).toBe(1);
			state.muted = false;
			yield* eventually(
				Effect.try(() => {
					expect(state.connections).toBeGreaterThanOrEqual(2);
					expect(state.resyncs).toBeGreaterThanOrEqual(3);
				}),
			).pipe(Effect.timeout("5 seconds"));
			expect(yield* listeners).toHaveLength(1);
			yield* invalidateOnCommit(["orders:1"]).pipe(transact({ onSqlError }));
			yield* eventually(Effect.try(() => expect(changes).toHaveLength(1))).pipe(Effect.timeout("5 seconds"));
			yield* close;
			expect(closing()).toBe(2);
		} finally {
			release();
		}
	},
);

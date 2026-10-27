import { Clock, Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { postgres } from "#test/sqlStory.ts";
import { listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"one listener outage logs its recovery after heartbeat and resync, including elapsed time and only open streams",
	[listeningForChanges({ heartbeatInterval: "1 second", heartbeatTimeout: "1 second", retryDelay: "1 second" })],
	function* ({ sql, notifications, recordedLogs }) {
		const { state, openStream, nextListener, nextMutedHeartbeat } = notifications();
		const first = yield* openStream();
		const second = yield* openStream();
		const closed = yield* openStream();
		yield* withLive(eventually(Effect.try(() => expect(closed.hints).toEqual([{ _tag: "Resync" }]))));
		yield* closed.close;
		expect(recordedLogs()).toEqual([]);
		state.unreachable = true;
		expect(yield* sql`select pg_terminate_backend(pid) as terminated from pg_stat_activity where query = ${`LISTEN "${state.channel}"`}`).toEqual([
			{ terminated: true },
		]);
		yield* withLive(
			eventually(
				Effect.try(() =>
					expect(recordedLogs().filter((log) => log.level === "Warn")).toMatchObject([
						{ message: ["PostgreSQL change listener lost; resynchronizing live streams"] },
					]),
				),
			),
		);
		const lostAt = yield* Clock.currentTimeMillis;
		expect(recordedLogs()).toMatchObject([{ cause: "", level: "Warn", message: ["PostgreSQL change listener lost; resynchronizing live streams"] }]);
		const retryIntervals = [1000, 1000];
		for (const [index, interval] of retryIntervals.entries()) {
			yield* TestClock.adjust(interval);
			yield* withLive(eventually(Effect.try(() => expect(recordedLogs().filter((log) => log.level === "Debug")).toHaveLength(index + 1))));
			expect(recordedLogs().filter((log) => log.level === "Warn")).toMatchObject([
				{ message: ["PostgreSQL change listener lost; resynchronizing live streams"] },
			]);
			expect(recordedLogs().filter((log) => log.level === "Info")).toEqual([]);
		}
		state.unreachable = false;
		state.muted = true;
		const reconnectInterval = 1000;
		const heartbeatDelay = 50;
		yield* TestClock.adjust(reconnectInterval);
		yield* nextListener;
		yield* TestClock.adjust(heartbeatDelay);
		const acknowledgeHeartbeat = yield* nextMutedHeartbeat;
		expect(recordedLogs().filter((log) => log.level === "Info")).toEqual([]);
		state.muted = false;
		yield* acknowledgeHeartbeat;
		yield* withLive(
			eventually(
				Effect.try(() =>
					expect(recordedLogs().filter((log) => log.level === "Info")).toMatchObject([
						{ message: ["PostgreSQL change listener recovered; resynchronized live streams"] },
					]),
				),
			),
		);
		const downtimeMs = (yield* Clock.currentTimeMillis) - lostAt;
		expect(downtimeMs).toBe(retryIntervals.reduce((total, interval) => total + interval, 0) + reconnectInterval + heartbeatDelay);
		expect(recordedLogs().filter((log) => log.level !== "Debug")).toEqual([
			{ annotations: {}, cause: "", level: "Warn", message: ["PostgreSQL change listener lost; resynchronizing live streams"] },
			{
				annotations: { downtimeMs, streamCount: 2 },
				cause: "",
				level: "Info",
				message: ["PostgreSQL change listener recovered; resynchronized live streams"],
			},
		]);
		yield* withLive(
			eventually(
				Effect.try(() => {
					expect(first.hints).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }, { _tag: "Resync" }, { _tag: "Resync" }, { _tag: "Resync" }]);
					expect(second.hints).toEqual(first.hints);
				}),
			),
		);
		expect(closed.hints).toEqual([{ _tag: "Resync" }]);
	},
	{ clock: "test" },
);

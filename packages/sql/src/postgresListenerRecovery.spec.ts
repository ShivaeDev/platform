import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"one listener outage logs its recovery after heartbeat and resync, including elapsed time and only open streams",
	[listeningForChanges({ heartbeatInterval: "1 second", heartbeatTimeout: "1 second", retryDelay: "1 second" })],
	function* ({ notifications, recordedLogs }) {
		const {
			openStream,
			nextListener,
			nextMutedHeartbeat,
			nextLoss,
			nextReconnect,
			nextRecovery,
			terminate,
			currentTime,
			intervalPasses,
			makeUnavailable,
			pauseDelivery,
			resumeDelivery,
			restoreAvailability,
		} = notifications();
		const first = yield* openStream();
		const second = yield* openStream();
		const closed = yield* openStream();
		yield* closed.nextHint;
		yield* closed.close;
		expect(recordedLogs()).toEqual([]);
		yield* makeUnavailable();
		yield* terminate;
		yield* nextLoss;
		const lostAt = yield* currentTime;
		expect(recordedLogs()).toMatchObject([
			{
				cause: expect.stringContaining("terminating connection due to administrator command"),
				level: "Warn",
				message: ["PostgreSQL change listener lost; resynchronizing live streams"],
			},
		]);
		const retryIntervals = [1000, 1000];
		for (const interval of retryIntervals) {
			yield* intervalPasses(interval);
			yield* nextReconnect;
			expect(recordedLogs().at(-1)?.cause).toContain("ECONNREFUSED");
			expect(recordedLogs().filter((log) => log.level === "Warn")).toMatchObject([
				{ message: ["PostgreSQL change listener lost; resynchronizing live streams"] },
			]);
			expect(recordedLogs().filter((log) => log.level === "Info")).toEqual([]);
		}
		yield* restoreAvailability();
		yield* pauseDelivery();
		const reconnectInterval = 1000;
		const heartbeatDelay = 50;
		yield* intervalPasses(reconnectInterval);
		yield* nextListener;
		yield* intervalPasses(heartbeatDelay);
		const acknowledgeHeartbeat = yield* nextMutedHeartbeat;
		expect(recordedLogs().filter((log) => log.level === "Info")).toEqual([]);
		yield* resumeDelivery();
		yield* acknowledgeHeartbeat;
		yield* nextRecovery;
		const downtimeMs = (yield* currentTime) - lostAt;
		expect(downtimeMs).toBe(retryIntervals.reduce((total, interval) => total + interval, 0) + reconnectInterval + heartbeatDelay);
		expect(recordedLogs().filter((log) => log.level !== "Debug")).toEqual([
			{
				annotations: {},
				cause: expect.stringContaining("terminating connection due to administrator command"),
				level: "Warn",
				message: ["PostgreSQL change listener lost; resynchronizing live streams"],
			},
			{
				annotations: { downtimeMs, streamCount: 2 },
				cause: "",
				level: "Info",
				message: ["PostgreSQL change listener recovered; resynchronized live streams"],
			},
		]);
		for (const stream of [first, second]) {
			for (let hint = 0; hint < 5; hint += 1) {
				yield* stream.nextHint;
			}
		}
		expect(first.hints).toEqual(Array.from({ length: 5 }, () => ({ _tag: "Resync" })));
		expect(second.hints).toEqual(first.hints);
		expect(closed.hints).toEqual([{ _tag: "Resync" }]);
	},
	{ clock: "test" },
);

import { expect } from "vitest";
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
	function* ({ notifications, recordedLogs }) {
		const {
			state,
			closeAtDeadline,
			nextMutedHeartbeat,
			nextListener,
			nextCleanup,
			nextResync,
			nextLoss,
			nextRecovery,
			intervalPasses,
			listenerPids,
			pauseDelivery,
			resumeDelivery,
		} = notifications();
		const originalListeners = yield* listenerPids;
		expect(originalListeners).toEqual([{ pid: expect.any(Number) }]);
		yield* pauseDelivery();
		yield* intervalPasses("1 hour");
		yield* nextMutedHeartbeat;
		yield* intervalPasses("150 millis");
		yield* nextResync;
		expect(state.resyncEvents).toEqual(["resync", "resync"]);
		yield* nextCleanup;
		expect(state.listenerOperations).toEqual(["listen", "cleanup"]);
		yield* resumeDelivery();
		yield* intervalPasses("150 millis");
		yield* nextLoss;
		expect(recordedLogs()).toMatchObject([{ cause: expect.stringContaining("heartbeat timed out"), level: "Warn" }]);
		yield* intervalPasses("20 millis");
		yield* nextListener;
		yield* intervalPasses("50 millis");
		yield* nextRecovery;
		expect(state.resyncEvents).toEqual(["resync", "resync", "resync"]);
		expect(state.listenerOperations).toEqual(["listen", "cleanup", "listen"]);
		expect(yield* listenerPids).toEqual([{ pid: expect.any(Number) }]);
		yield* closeAtDeadline();
		expect(state.listenerOperations).toEqual(["listen", "cleanup", "listen", "cleanup"]);
	},
	{ clock: "test" },
);

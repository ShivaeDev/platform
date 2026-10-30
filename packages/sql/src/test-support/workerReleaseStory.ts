import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { configured, postgresLayer } from "./postgres.ts";
import { RecordedLogs } from "./RecordedLogs.ts";
import { workerReleaseEngine } from "./workerReleaseEngine.ts";

export const workerReleaseStory = storyKit({
	clock: "test",
	create: workerReleaseEngine,
	layer: Layer.mergeAll(postgresLayer, Reactivity.layer, RecordedLogs.layer),
	name: "worker release",
	runIf: configured,
	stages: [],
	verbs: (engine) => ({
		claimSecond: () => engine.claimSecond,
		connectionFails: engine.fault,
		finishDrain: () => engine.finishDrain,
		nextFailure: () => engine.failure,
		owningScopeFailure: () => engine.closed,
		pollIntervalPasses: () => TestClock.adjust("1 second"),
		retryDelayPasses: () => TestClock.adjust("250 millis"),
		startDrain: () => engine.drain,
		waitForDrain: () => engine.draining,
		waitForHeartbeat: () => engine.heartbeat.pipe(Effect.asVoid),
	}),
});

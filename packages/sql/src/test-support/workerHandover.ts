import { Cause, Deferred, Effect, Exit, Queue } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { onPostgres } from "./engines.ts";
import { handoverEngine, inWords, type Loop } from "./workerHandoverEngine.ts";

type HandoverEngine = Effect.Success<ReturnType<typeof handoverEngine>>;

const POLL_INTERVAL = "1 second";
const RETRY_DELAY = "250 millis";

function arm(engine: HandoverEngine, loop: Loop, permanent: boolean) {
	return Effect.sync(() => {
		engine.fault.loop = loop;
		engine.fault.permanent = permanent;
	});
}

export const workerHandover = storyKit({
	...onPostgres,
	clock: "test",
	create: handoverEngine,
	inspect: (engine) => ({ fault: engine.fault, timeline: engine.timeline, warnings: engine.logged }),
	name: "worker release handover",
	stages: ["release"],
	verbs: (engine, story) => ({
		connectionBlipsOnce: (loop: Loop) =>
			Effect.suspend(() => {
				story.tell(`the ${loop} loop's next query loses its connection once`);
				return arm(engine, loop, false);
			}),
		connectionDiesFor: (loop: Loop) =>
			Effect.suspend(() => {
				story.tell(`every ${loop} query from now on loses its connection`);
				return arm(engine, loop, true);
			}),
		drainStarts: () => Effect.as(Deferred.await(engine.draining), "draining"),
		drainState: () => Effect.map(Deferred.isDone(engine.draining), (done) => (done ? "draining" : "not draining")),
		loggedWarnings: () => Effect.sync(() => [...engine.logged]),
		nextHeartbeat: () => Effect.as(Queue.take(engine.heartbeats), "a heartbeat").pipe(Effect.orDie),
		nextWarning: () => Queue.take(engine.warnings),
		originalFailurePreserved: () => engine.originalFailure,
		owningScopeEnding: () =>
			Effect.map(Deferred.await(engine.closed), (exit) =>
				Exit.isFailure(exit) ? `failed with ${inWords(Cause.pretty(exit.cause))}` : "clean shutdown",
			),
		pollIntervalPasses: () =>
			Effect.suspend(() => {
				story.tell(`the ${POLL_INTERVAL} poll interval passes`);
				return TestClock.adjust(POLL_INTERVAL);
			}),
		recordSecondRelease: () => engine.recordSecondRelease,
		retriesRunOut: () =>
			Effect.gen(function* () {
				story.tell(`the poll interval passes, then the ${RETRY_DELAY} retry delay passes after each of the three retries' failures`);
				yield* TestClock.adjust(POLL_INTERVAL);
				for (let retry = 0; retry < 3; retry += 1) {
					yield* Queue.take(engine.warnings);
					yield* TestClock.adjust(RETRY_DELAY);
				}
				yield* Queue.take(engine.warnings);
			}),
		retryDelayPasses: () =>
			Effect.suspend(() => {
				story.tell(`the ${RETRY_DELAY} retry delay passes`);
				return TestClock.adjust(RETRY_DELAY);
			}),
		secondReleaseClaims: () =>
			Effect.suspend(() => {
				story.tell("a worker of the second release tries to claim its process row");
				return Effect.map(engine.second.claim, (claimed) => (claimed ? "claimed" : "refused"));
			}).pipe(Effect.orDie),
		secondWorkerStarts: () => Effect.asVoid(engine.startSecond),
		timeline: () => Effect.sync(() => [...engine.timeline]),
		workingQueues: () => Effect.sync(engine.worker.workingQueues),
	}),
});

export function secondReleaseRecorded() {
	return workerHandover.trait("release", "the second release is recorded as the database's owner", (engine) =>
		Effect.orDie(engine.recordSecondRelease),
	);
}

export function drainingForSecondRelease() {
	return workerHandover.trait(
		"release",
		"the second release is recorded, and after one poll the first release's worker drains while its heartbeat beats",
		(engine) =>
			Effect.gen(function* () {
				yield* engine.worker.holdJob;
				yield* Effect.orDie(engine.recordSecondRelease);
				yield* TestClock.adjust(POLL_INTERVAL);
				yield* Deferred.await(engine.draining);
				yield* Effect.orDie(Queue.take(engine.heartbeats));
			}),
	);
}

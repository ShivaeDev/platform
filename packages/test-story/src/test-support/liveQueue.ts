import { Clock, Deferred, Effect, Fiber } from "effect";
import { eventually } from "@shivaedev/test/eventually.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { storyKit } from "#storyKit.ts";

function* drain() {
	let finished = false;
	let attempts = 0;
	const polled = yield* Deferred.make<void>();
	const worker = yield* Effect.forkChild(
		withLive(
			Effect.gen(function* () {
				yield* Deferred.await(polled);
				yield* Effect.sleep("20 millis");
				finished = true;
			}),
		),
	);
	yield* withLive(
		eventually(
			Effect.gen(function* () {
				attempts += 1;
				if (attempts === 1) {
					yield* Deferred.succeed(polled, undefined);
					return yield* Effect.fail("jobs pending");
				}
				return yield* finished ? Effect.void : Effect.fail("jobs pending");
			}),
			{ interval: "5 millis", times: 200 },
		),
	);
	yield* Fiber.join(worker);
	return attempts;
}

export const liveQueue = storyKit({
	after: {
		*built(engine) {
			engine.pollingAttempts.push(yield* drain());
			engine.afterAt = yield* Clock.currentTimeMillis;
		},
	},
	clock: "live",
	*create() {
		const createdAt = yield* Clock.currentTimeMillis;
		const attempts = yield* drain();
		const completedSteps: string[] = [];
		return { afterAt: -1, completedSteps, createdAt, pollingAttempts: [attempts], steps: 0 };
	},
	name: "queue",
	run: {
		maxSteps: 1,
		*step(engine) {
			engine.pollingAttempts.push(yield* drain());
			engine.steps += 1;
			engine.completedSteps.push("queue drained");
		},
	},
	stages: ["built"],
	verbs: (_engine, story) => ({ finish: () => story.runUntil((engine) => engine.steps === 1) }),
});

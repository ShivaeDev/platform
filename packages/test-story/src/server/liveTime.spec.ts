import { Clock, Deferred, Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { withLive } from "@shivaedev/effect-test/withLive.ts";
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
	expect(attempts).toBeGreaterThan(1);
}

const kit = storyKit({
	after: {
		*built(engine) {
			yield* drain();
			engine.afterAt = yield* Clock.currentTimeMillis;
		},
	},
	clock: "live",
	*create() {
		const createdAt = yield* Clock.currentTimeMillis;
		yield* drain();
		return { afterAt: -1, createdAt, steps: 0 };
	},
	name: "queue",
	run: {
		maxSteps: 1,
		*step(engine) {
			yield* drain();
			engine.steps += 1;
		},
	},
	stages: ["built"],
	verbs: (_engine, story) => ({ finish: () => story.runUntil((engine) => engine.steps === 1) }),
});

kit.it("hooks and steps poll in live time in a live-clock story", [], function* ({ finish, story }) {
	expect(story.engine.createdAt).toBeGreaterThan(1_000_000);
	expect(story.engine.afterAt).toBeGreaterThanOrEqual(story.engine.createdAt);
	yield* finish();
	expect(story.engine.steps).toBe(1);
	expect(yield* Clock.currentTimeMillis).toBeGreaterThanOrEqual(story.engine.afterAt);
});

kit.it(
	"hooks and steps poll without moving token expiry in a TestClock story",
	[],
	function* ({ finish, story }) {
		expect(story.engine.createdAt).toBe(0);
		expect(story.engine.afterAt).toBe(0);
		const tokenExpired = yield* Effect.forkChild(Effect.sleep("1 second").pipe(Effect.as(true)));
		yield* finish();
		expect(story.engine.steps).toBe(1);
		expect(yield* Clock.currentTimeMillis).toBe(0);
		expect(tokenExpired.pollUnsafe()).toBeUndefined();
		yield* TestClock.adjust("1 second");
		expect(yield* Fiber.join(tokenExpired)).toBe(true);
		expect(yield* Clock.currentTimeMillis).toBe(1000);
	},
	{ clock: "test" },
);

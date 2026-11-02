import { Clock, Deferred, Effect, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

interface FixtureClock {
	readonly finished: Deferred.Deferred<void>;
	wokeAt: number | undefined;
}

const clockLayer = Layer.effect(
	Clock.Clock,
	Effect.gen(function* () {
		const clock = yield* TestClock.make();
		yield* clock.setTime(1000);
		return clock;
	}),
);

export const fixtureClock = storyKit({
	*create() {
		const engine: FixtureClock = { finished: yield* Deferred.make<void>(), wokeAt: undefined };
		return engine;
	},
	layer: clockLayer,
	name: "fixture clock",
	stages: [],
	verbs: (engine, story) => ({
		aSecondPasses: () => {
			story.tell("one second passes on the fixture clock");
			return Effect.andThen(TestClock.adjust("1 second"), Deferred.await(engine.finished));
		},
		clock: () => Clock.currentTimeMillis,
		startsSleeping: () => {
			story.tell("a child sleeps for one second");
			return Effect.forkChild(
				Effect.gen(function* () {
					yield* Effect.sleep("1 second");
					engine.wokeAt = yield* Clock.currentTimeMillis;
					yield* Deferred.succeed(engine.finished, undefined);
				}),
			);
		},
		wokeAt: () => Effect.sync(() => engine.wokeAt),
	}),
});

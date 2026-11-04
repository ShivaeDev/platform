import { Clock, Data, Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { withLive } from "#withLive.ts";
import { clockReading } from "./clockReading.ts";
import { driveClock } from "./driveClock.ts";

class NotReady extends Data.TaggedError("NotReady")<{ readonly message: string }> {}

interface LiveRegionEngine {
	answer: unknown;
	regionClock: string | undefined;
	waitMillis: number;
	withoutTestClock: boolean;
}

export const liveRegion = storyKit({
	create: (): LiveRegionEngine => ({ answer: undefined, regionClock: undefined, waitMillis: 0, withoutTestClock: false }),
	inspect: (engine) => engine,
	name: "live region",
	stages: ["clock"],
	verbs: (engine, story) => ({
		answer: () => Effect.sync(() => engine.answer),
		clock: () => clockReading,
		clockInRegion: () => Effect.sync(() => engine.regionClock),
		runsLiveRegion: (ending: "succeeds" | "fails") => {
			story.tell(`a live region reads its clock and ${ending}`);
			const region = Effect.gen(function* () {
				engine.regionClock = yield* clockReading;
				return ending === "succeeds" ? "ready" : yield* new NotReady({ message: "not ready" });
			});
			const running = withLive(region);
			return Effect.map(answered(driveClock(engine.withoutTestClock ? running : Effect.provide(running, TestClock.layer()))), (answer) => {
				engine.answer = answer;
			});
		},
		waitMillis: () => Effect.sync(() => engine.waitMillis),
		waitsInRegion: () => {
			story.tell("the kit drives a live region's clock through its 30 millisecond sleep");
			return driveClock(
				withLive(
					Effect.gen(function* () {
						const started = yield* Clock.currentTimeMillis;
						yield* Effect.sleep("30 millis");
						engine.waitMillis = (yield* Clock.currentTimeMillis) - started;
					}),
				).pipe(Effect.provide(TestClock.layer())),
			);
		},
	}),
});

export const withoutTestClock = liveRegion.trait("clock", "the region starts on a controlled Clock without TestClock's controls", (engine) => {
	engine.withoutTestClock = true;
});

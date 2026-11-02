import { Clock, Duration, Effect, Stream } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { CloneStory } from "./cloneStory.ts";
import { configured, setup, values } from "./postgres.ts";

export const cloneClock = storyKit({
	clock: "test",
	*create() {
		const clone = new CloneStory();
		const state = { clone, elapsed: 0, sleeps: 0 };
		const clock = yield* watchedClock;
		yield* Stream.runForEach(clock.sleeps, () =>
			Effect.sync(() => {
				state.sleeps += 1;
			}),
		).pipe(Effect.forkScoped);
		yield* clone.acquire();
		return state;
	},
	inspect: ({ elapsed, sleeps }) => ({ elapsed, sleeps }),
	layer: setup().layer,
	name: "clone clock",
	runIf: configured,
	stages: [],
	verbs: (state, story) => ({
		elapsedMilliseconds: () => {
			story.tell("the story reads the elapsed wall clock time");
			return Effect.sync(() => state.elapsed);
		},
		hundredDaysPass: () =>
			Effect.gen(function* () {
				story.tell("100 days pass while the cloned database stays open");
				const live = Clock.Clock.defaultValue();
				const started = live.monotonicTimeNanosUnsafe();
				yield* TestClock.adjust("100 days");
				state.elapsed = Duration.toMillis(Duration.nanos(live.monotonicTimeNanosUnsafe() - started));
			}),
		items: () => {
			story.tell("the story reads the cloned database’s items");
			return state.clone.run(values);
		},
		storyTime: () => {
			story.tell("the story reads the cloned database’s clock");
			return state.clone.run(Clock.currentTimeMillis);
		},
		testClockSleeps: () => {
			story.tell("the story reads how many sleeps the test clock observed");
			return Effect.sync(() => state.sleeps);
		},
	}),
});

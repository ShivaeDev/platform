import { Clock, Console, Effect, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";

export const consoleEnvironment = storyKit({
	create: () => Effect.void,
	name: "runner console",
	stages: [],
	verbs: () => ({
		log: (message: string) => Console.log(message),
		output: () => TestConsole.logLines,
	}),
});

export const fixtureClock = storyKit({
	around: (effect) => Effect.andThen(Clock.currentTimeMillis.pipe(Effect.flatMap(Console.log)), effect),
	create: () => Clock.currentTimeMillis,
	layer: Layer.effect(
		Clock.Clock,
		Effect.gen(function* () {
			const clock = yield* TestClock.make();
			yield* clock.setTime(1234);
			return clock;
		}),
	),
	name: "runner fixture clock",
	stages: [],
	verbs: (harnessTime) => ({
		advance: (millis: number) => TestClock.adjust(millis),
		harnessTime: () => harnessTime,
		now: () => Clock.currentTimeMillis,
		output: () => TestConsole.logLines,
		sleep: (millis: number) => Effect.sleep(millis),
	}),
});

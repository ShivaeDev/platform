import { Clock, DateTime, Effect, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type { EffectClock } from "#types.ts";

const TestClockEnvironment = Layer.mergeAll(TestConsole.layer, TestClock.layer());
const LiveClockEnvironment = TestConsole.layer;

export function environmentFor(clock: EffectClock) {
	if (typeof clock === "string") {
		return clock === "live" ? LiveClockEnvironment : TestClockEnvironment;
	}
	return Layer.mergeAll(
		TestConsole.layer,
		Layer.effect(
			Clock.Clock,
			Effect.gen(function* () {
				const testClock = yield* TestClock.make();
				yield* testClock.setTime(DateTime.toEpochMillis(clock));
				return testClock;
			}),
		),
	);
}

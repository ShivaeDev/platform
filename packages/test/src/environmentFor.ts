import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
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

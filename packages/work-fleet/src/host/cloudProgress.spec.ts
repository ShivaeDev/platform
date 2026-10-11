import { describe, expect } from "@effect/vitest";
import { Cause, Clock, Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { it } from "@shivaedev/effect-test/it.ts";
import { until } from "#test/cloudRestart.ts";

describe("Cloud restart progress waiting", () => {
	it.effect("launch progress can continue beyond the original wall-clock deadline", function* () {
		const waiting = yield* until(() =>
			Clock.currentTimeMillis.pipe(Effect.map((now) => ({ done: now >= 45_000, progress: Math.floor(now / 15_000) }))),
		).pipe(Effect.forkChild);
		yield* TestClock.adjust("15 seconds");
		yield* TestClock.adjust("15 seconds");
		yield* TestClock.adjust("15 seconds");
		yield* Fiber.join(waiting);
		expect(yield* Clock.currentTimeMillis).toBe(45_000);
	});

	it.effect("unchanged progress still fails after the stall budget", function* () {
		const waiting = yield* until(() => Effect.succeed({ done: false, progress: 1 })).pipe(Effect.exit, Effect.forkChild);
		yield* TestClock.adjust("20 seconds");
		const result = yield* Fiber.join(waiting);
		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			expect(Cause.pretty(result.cause)).toContain("Restart progress stalled at 1 for 20 seconds");
		}
	});
});

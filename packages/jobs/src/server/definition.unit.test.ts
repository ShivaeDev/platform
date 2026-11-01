import { Duration } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { it } from "@shivaedev/test/adapters/it.ts";
import { jobContext } from "#definition.ts";
import { job } from "#test/fakeClient.ts";

it.effect("recomputes a typed remaining budget from the runtime deadline, clamped to zero", function* () {
	const context = jobContext(job("budget", {}), 2000);
	yield* TestClock.adjust(1200);
	expect(Duration.toMillis(yield* context.remainingBudget)).toBe(800);
	yield* TestClock.adjust(400);
	expect(Duration.toMillis(yield* context.remainingBudget)).toBe(400);
	yield* TestClock.adjust(600);
	expect(Duration.toMillis(yield* context.remainingBudget)).toBe(0);
});

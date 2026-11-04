import { Duration } from "effect";
import { expect } from "vitest";
import { context } from "#test/context.ts";

context.it("recomputes a typed remaining budget from the runtime deadline, clamped to zero", [], function* ({ clockPasses, remainingBudget }) {
	yield* clockPasses(1200);
	expect(yield* remainingBudget()).toEqual(Duration.millis(800));
	yield* clockPasses(400);
	expect(yield* remainingBudget()).toEqual(Duration.millis(400));
	yield* clockPasses(600);
	expect(yield* remainingBudget()).toEqual(Duration.zero);
});

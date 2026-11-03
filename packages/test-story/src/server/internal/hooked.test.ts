import { expect } from "vitest";
import { hookRunner } from "#test/hookRunner.ts";

hookRunner.it("defers an Effect-returning hook until the story runs it", [], function* ({ calls, runs }) {
	expect(calls()).toBe(0);

	const value = yield* runs();

	expect(value).toBe(42);
	expect(calls()).toBe(1);
});

hookRunner.it("keeps a returned Effect's typed failure in the error channel", [], function* ({ runsRefusingHook }) {
	expect(yield* runsRefusingHook()).toBe("failed with engine refused");
});

hookRunner.it("keeps a returned Effect's interruption", [], function* ({ runsInterruptedHook }) {
	expect(yield* runsInterruptedHook()).toBe("interrupted");
});

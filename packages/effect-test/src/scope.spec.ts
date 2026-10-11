import { Effect, Layer } from "effect";
import { afterAll, expect } from "vitest";
import { makeEffectIt } from "#vitest.ts";

const closed: string[] = [];
const { effectApp } = makeEffectIt({
	around: (effect) =>
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Effect.sync(() => closed.push("wrapper")));
			return yield* effect;
		}),
	layer: Layer.empty,
	makeHarness: () => Effect.acquireRelease(Effect.succeed("harness"), (name) => Effect.sync(() => closed.push(name))),
});

effectApp.each(["first", "second"])("closes table resources on success: %s", function* (name, harness) {
	expect(harness).toBe("harness");
	yield* Effect.acquireRelease(Effect.succeed(name), (value) => Effect.sync(() => closed.push(value)));
});
effectApp.fails("closes resources on failure", function* () {
	yield* Effect.addFinalizer(() => Effect.sync(() => closed.push("failed body")));
	yield* Effect.fail("intentional failure");
});
afterAll(() => {
	expect(closed).toEqual(["first", "harness", "wrapper", "second", "harness", "wrapper", "failed body", "harness", "wrapper"]);
});

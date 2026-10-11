import { Effect, Layer } from "effect";
import { afterAll, expect } from "vitest";
import { makeEffectIt } from "#vitest.ts";

// Vitest retries `.fails` tests in the merge queue, so every attempt records its own events.
const attempts: { readonly name: string; readonly closed: string[] }[] = [];
let opening: string[] = [];
const { effectApp } = makeEffectIt({
	around: (effect) =>
		Effect.gen(function* () {
			const closed: string[] = [];
			opening = closed;
			yield* Effect.addFinalizer(() => Effect.sync(() => closed.push("wrapper")));
			return yield* effect;
		}),
	layer: Layer.empty,
	makeHarness: (context) =>
		Effect.acquireRelease(
			Effect.sync(() => {
				const attempt = { closed: opening, name: context.task.name };
				attempts.push(attempt);
				return attempt;
			}),
			({ closed }) => Effect.sync(() => closed.push("harness")),
		),
});

effectApp.each(["first", "second"])("closes table resources on success: %s", function* (name, { closed }) {
	yield* Effect.acquireRelease(Effect.succeed(name), (value) => Effect.sync(() => closed.push(value)));
});
effectApp.fails("closes resources on failure", function* ({ closed }) {
	yield* Effect.addFinalizer(() => Effect.sync(() => closed.push("failed body")));
	yield* Effect.fail("intentional failure");
});
afterAll(() => {
	const expected: Readonly<Record<string, readonly string[]>> = {
		"closes resources on failure": ["failed body", "harness", "wrapper"],
		"closes table resources on success: first": ["first", "harness", "wrapper"],
		"closes table resources on success: second": ["second", "harness", "wrapper"],
	};
	expect(new Set(attempts.map(({ name }) => name))).toEqual(new Set(Object.keys(expected)));
	for (const { name, closed } of attempts) {
		expect(closed, name).toEqual(expected[name]);
	}
});

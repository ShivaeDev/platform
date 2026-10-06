import { Effect, Layer } from "effect";
import { expect, it } from "vitest";
import { makeEffectIt } from "#vitest.ts";

const { effectApp } = makeEffectIt({ layer: Layer.empty, makeHarness: () => Effect.void });
const failures: string[] = [];
let releases = 0;

effectApp(
	"stalled application",
	function* (_harness, { onTestFailed }) {
		onTestFailed(({ task }) => {
			failures.push(...(task.result?.errors ?? []).map((error) => error.message));
		});
		yield* Effect.ensuring(
			Effect.never,
			Effect.sync(() => {
				releases += 1;
			}),
		);
	},
	25,
);

it("reports the numeric timeout and closes the interrupted test scope", () => {
	expect(failures).toHaveLength(1);
	expect(failures[0]).toContain("Test timed out in 25ms.");
	expect(releases).toBe(1);
});

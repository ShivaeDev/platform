import { Effect, Layer } from "effect";
import { it } from "vitest";
import { makeEffectIt } from "#makeEffectIt.ts";

const { effectApp } = makeEffectIt({
	layer: Layer.empty,
	makeHarness: () => Effect.void,
});

effectApp(
	"application with stuck cleanup",
	function* () {
		yield* Effect.addFinalizer(() => Effect.never);
		yield* Effect.never;
	},
	25,
);

it("runs after the scope close timeout", () => undefined);

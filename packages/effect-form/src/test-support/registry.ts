import { Effect, Layer } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";

export const { effectApp: it } = makeEffectIt({
	layer: Layer.empty,
	makeHarness: (context) =>
		Effect.sync(() => {
			const registry = AtomRegistry.make();
			context.onTestFinished(() => registry.dispose());
			return registry;
		}),
});

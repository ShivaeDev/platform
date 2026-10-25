import { Effect, Layer } from "effect";
import { makeEffectIt } from "#makeEffectIt.ts";
import { runVitest } from "./runVitest.ts";

export const runner = makeEffectIt({
	clock: "live",
	layer: Layer.empty,
	makeHarness: () =>
		Effect.succeed({
			runVitest: (fixture: string, reporter?: string) => Effect.sync(() => runVitest(fixture, reporter)),
		}),
});

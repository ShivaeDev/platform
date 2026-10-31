import { Effect, Layer } from "effect";
import { makeEffectIt } from "#makeEffectIt.ts";
import { releasedOnClose } from "./lifecycleLog.ts";

const { effectApp } = makeEffectIt({ layer: Layer.empty, makeHarness: () => releasedOnClose("the harness's resource") });

effectApp(
	"a body that never finishes",
	function* () {
		yield* releasedOnClose("the body's resource");
		yield* Effect.never;
	},
	25,
);

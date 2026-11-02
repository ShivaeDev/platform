import { Data, Effect, Layer } from "effect";
import { makeEffectIt } from "#adapters/makeEffectIt.ts";
import { releasedOnClose } from "./lifecycleLog.ts";

class BodyFailure extends Data.TaggedError("BodyFailure")<{ readonly message: string }> {}

const { effectApp } = makeEffectIt({
	around: (effect) => Effect.andThen(releasedOnClose("the wrapper's resource"), effect),
	layer: Layer.empty,
	makeHarness: () => releasedOnClose("the harness's resource"),
});

effectApp("a body that succeeds holding its resource", function* () {
	yield* releasedOnClose("the body's resource");
});

effectApp("a body that fails holding its resource", function* () {
	yield* releasedOnClose("the body's resource");
	return yield* new BodyFailure({ message: "the body failed" });
});

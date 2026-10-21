import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";

export const resultReview = Effect.fn("Fleet.resultReview")(function* (state: EngineState, head: string) {
	const policy = yield* state.current;
	return {
		reviewAdvisoryHead: policy.review === "advisory" ? head : undefined,
		reviewSkippedHead: policy.review === false ? head : undefined,
		step: policy.review === false ? ("validating" as const) : ("reviewing" as const),
	};
});

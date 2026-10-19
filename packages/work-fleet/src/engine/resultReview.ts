import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";

export const resultReview = Effect.fn("Fleet.resultReview")(function* (state: EngineState, head: string) {
	const policy = yield* state.current;
	return {
		reviewSkippedHead: policy.review === false ? head : undefined,
		stage: policy.review === false ? ("validating" as const) : ("reviewing" as const),
	};
});

import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export const acceptTurn = Effect.fnUntraced(function* (options: EngineOptions, turns: number) {
	const failure = options.submissionFailure?.("turn");
	if (failure !== undefined) {
		return yield* Effect.fail(failure);
	}
	if (turns === 2 && options.continuationGate !== undefined) {
		yield* options.continuationGate;
	}
	if (options.rejectTurn) {
		return yield* Effect.fail(new SessionFailure({ message: "Provider rejected turn before acceptance", reason: "rejected" }));
	}
	if (options.unavailableTurn) {
		return yield* Effect.fail(new SessionFailure({ message: "Provider unavailable after session acknowledgement", reason: "unavailable" }));
	}
});

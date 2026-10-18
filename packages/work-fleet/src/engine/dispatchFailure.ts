import { Effect } from "effect";
import { waitingOwner } from "#attention.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseMissingBoardWork } from "#engine/missingBoardWork.ts";
import { readRetry } from "#engine/readRetry.ts";

export const dispatchFailure = Effect.fn("Fleet.dispatchFailure")(function* <E>(state: EngineState, workId: string, error: E) {
	const current = yield* state.load(workId);
	const released = yield* releaseMissingBoardWork(state, current, error);
	if (released !== undefined) {
		return released;
	}
	const retrying = yield* readRetry(state, current, error);
	if (retrying !== undefined) {
		return retrying;
	}
	const waiting = { ...current.value, attentionOwner: failureOwner(error), blocker: failureMessage(error) };
	// Unchanged waits must not write and wake every subscriber on every scheduler pass.
	if (current.value.stage === "prepared" && (current.value.blocker !== waiting.blocker || current.value.attentionOwner !== waitingOwner(waiting))) {
		yield* state.save(current, waiting);
	}
	return yield* Effect.fail(error);
});

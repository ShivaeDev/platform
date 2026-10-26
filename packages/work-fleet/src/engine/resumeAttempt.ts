import { Effect } from "effect";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { obtainReview } from "#engine/obtainReview.ts";
import { retryPrompt } from "#engine/retryPrompt.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const resumeAttempt = Effect.fn("Fleet.resumeAttempt")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	attempt: Attempt,
	recovery: { readonly observationRetries: number },
) {
	const sessionId = attempt.receipt?.sessionId;
	if (sessionId === undefined) {
		return stored;
	}
	const prompt = retryPrompt(stored.value, attempt);
	if (attempt.role === "reviewer") {
		const work = yield* state.board.get(stored.value.workId);
		if (stored.value.result === undefined) {
			return stored;
		}
		yield* obtainReview(state)(stored, work, stored.value.result, { ...recovery, prompt: attempt.prompt ?? prompt, sessionId });
		return yield* state.load(stored.value.workId);
	}
	return yield* makeLaunch(state)(stored, attempt.role, prompt, { ...recovery, responses: stored.value.responses ?? [], sessionId });
});

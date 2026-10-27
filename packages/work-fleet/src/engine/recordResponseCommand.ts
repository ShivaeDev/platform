import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { makeHuman } from "#engine/makeHuman.ts";
import type { EngineState } from "#engine/makeState.ts";
import { readResolution } from "#engine/readResolution.ts";
import { cleanupSessions } from "#engine/sessionCleanup.ts";

export function recordResponseCommand(state: EngineState) {
	return Effect.fn("Fleet.recordResponse")(function* (workId: string, decisionId: string, responseId: string) {
		const stored = yield* state.load(workId);
		const receipts = [...(stored.value.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(stored.value.responses ?? [])];
		if (receipts.some((receipt) => receipt.decisionId === decisionId && receipt.responseId === responseId)) {
			return stored;
		}
		if (stored.value.step !== "waiting" || stored.value.decision?.id !== decisionId) {
			return yield* new Conflict({ message: "Decision changed" });
		}
		yield* readResolution(state.board, stored.value.decision, responseId);
		const recorded = yield* state.save(stored, { ...stored.value, blocker: ANSWER_RECORDED });
		yield* state.load(workId).pipe(
			Effect.flatMap(makeHuman(state)),
			Effect.flatMap(cleanupSessions(state)),
			Effect.catch((error) => recordFailure(state, workId, error)),
			Effect.catchCause(Effect.logError),
			Effect.forkIn(state.launchScope),
		);
		return recorded;
	});
}

const recordFailure = Effect.fn("Fleet.recordFailure")(function* (state: EngineState, workId: string, error: unknown) {
	yield* Effect.logError(`Failed to apply answer for ${workId}`, error);
	const current = yield* state.load(workId);
	return yield* current.value.blocker === ANSWER_RECORDED
		? state.save(current, { ...current.value, blocker: `Answer failed: ${failureMessage(error)}` })
		: Effect.succeed(current);
});

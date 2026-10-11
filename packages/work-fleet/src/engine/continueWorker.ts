import { Effect } from "effect";
import { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";
import { type DecisionResponse, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function continueWorker(state: EngineState) {
	return Effect.fn("Fleet.continueWorker")(function* (stored: Versioned<FleetRecord>, responses: readonly DecisionResponse[], prompt: string) {
		const worker = stored.value.decision?.worker;
		const latest = stored.value.attempts.at(-1);
		if (
			worker === undefined
			|| latest?.receipt?.sessionId !== worker.sessionId
			|| latest.receipt.turnId !== worker.turnId
			|| latest.role === "reviewer"
			|| latest.status !== "completed"
			|| executing(stored.value)
		) {
			return yield* Effect.fail(new FleetFailure({ message: "Confirm the exact question turn is terminal before continuing", reason: "denied" }));
		}
		const work = yield* state.board.get(stored.value.workId);
		if (work.revision !== stored.value.boardRevision) {
			return yield* Effect.fail(new FleetFailure({ message: "Board context changed before worker continuation", reason: "stale" }));
		}
		return yield* makeLaunch(state)(stored, latest.role, prompt, { responses, sessionId: worker.sessionId });
	});
}

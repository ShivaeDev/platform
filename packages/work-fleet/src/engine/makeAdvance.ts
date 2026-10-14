import { Effect } from "effect";
import { authorizeBriefContext, briefChanged, stopChangedBrief } from "#engine/boardBrief.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { makeAdopt } from "#engine/makeAdopt.ts";
import { makeDeliver } from "#engine/makeDeliver.ts";
import { makeHuman } from "#engine/makeHuman.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import { makeObserve } from "#engine/makeObserve.ts";
import { makeReview } from "#engine/makeReview.ts";
import type { EngineState } from "#engine/makeState.ts";
import { makeValidate } from "#engine/makeValidate.ts";
import { releaseClosedPreparation } from "#engine/releaseClosedPreparation.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
export function makeAdvance(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.advance")(function* (workId: string) {
		let stored = yield* state.load(workId);
		stored = yield* closeDecisions(state)(stored);
		if (["completed", "released"].includes(stored.value.stage)) {
			return stored;
		}
		if (stored.value.stage === "needs-human") {
			stored = yield* makeDeliver(state)(stored);
			stored = (yield* releaseClosedPreparation(state, stored, yield* state.board.get(workId))) ?? stored;
		}
		stored = yield* makeHuman(state)(stored);
		if (
			stored.value.stage === "executing"
			&& stored.value.attempts.at(-1)?.receipt === undefined
			&& briefChanged(stored.value, yield* state.board.get(workId))
		) {
			return yield* stopChangedBrief(state)(stored);
		}
		stored = yield* makeObserve(state)(stored);
		stored = yield* makeDeliver(state)(stored);
		if (stored.value.stage === "needs-human") {
			stored = (yield* releaseClosedPreparation(state, stored, yield* state.board.get(workId))) ?? stored;
		}
		if (!["completed", "released"].includes(stored.value.stage) && briefChanged(stored.value, yield* state.board.get(workId))) {
			return yield* stopChangedBrief(state)(stored);
		}
		return yield* advanceExecution(state, launch)(stored);
	});
}

function advanceExecution(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.advanceExecution")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		if (["completed", "released", "prepared", "needs-human"].includes(stored.value.stage)) {
			return stored;
		}
		const work = yield* state.board.get(stored.value.workId);
		yield* authorizeBriefContext(stored.value, work);
		stored = yield* makeAdopt(state)(stored, work);
		stored = yield* makeDeliver(state)(stored);
		stored = yield* makeReview(state)(stored, work);
		if (stored.value.stage === "repairing") {
			stored = yield* makeDeliver(state)(stored);
			if (stored.value.stage === "released") {
				return stored;
			}
			return yield* launch(stored, "repair", stored.value.checks?.repairPrompt ?? stored.value.review?.repairPrompt ?? stored.value.prompt);
		}
		stored = yield* makeValidate(state)(stored, work);
		if (stored.value.stage === "repairing") {
			stored = yield* makeDeliver(state)(stored);
			if (stored.value.stage === "released") {
				return stored;
			}
			return yield* launch(stored, "repair", stored.value.checks?.repairPrompt ?? "Fix required checks");
		}
		return yield* makeDeliver(state)(stored).pipe(Effect.flatMap(closeDecisions(state)));
	});
}

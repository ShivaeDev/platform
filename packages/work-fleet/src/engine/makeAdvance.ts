import { Effect } from "effect";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { deliverPendingAnswers } from "#engine/deliverPendingAnswers.ts";
import { makeAdopt } from "#engine/makeAdopt.ts";
import { makeDeliver } from "#engine/makeDeliver.ts";
import { makeHuman } from "#engine/makeHuman.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import { makeReview } from "#engine/makeReview.ts";
import type { EngineState } from "#engine/makeState.ts";
import { makeValidate } from "#engine/makeValidate.ts";
import { observeExecution } from "#engine/observeExecution.ts";
import { holdPredictedReview, reconcilePrediction } from "#engine/reconcilePrediction.ts";
import { holdPendingReady } from "#engine/reconcileSweepHold.ts";
import { reconcileBrief } from "#engine/refreshBrief.ts";
import { releaseClosedPreparation } from "#engine/releaseClosedPreparation.ts";
import { observeReleasedDeliveries } from "#engine/releasedDeliveries.ts";
import { settleReleasedWork } from "#engine/settleReleasedWork.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
export function makeAdvance(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.advance")(function* (workId: string) {
		let stored = yield* state.load(workId);
		stored = yield* holdPendingReady(state, stored);
		stored = yield* closeDecisions(state)(stored);
		stored = yield* observeReleasedDeliveries(state, stored);
		stored = yield* settleReleasedWork(state, stored);
		if (stored.value.pendingContinuation !== undefined) {
			return yield* launch(stored, "repair", stored.value.pendingContinuation);
		}
		if (["done", "released"].includes(stored.value.step)) {
			return stored;
		}
		stored = yield* reconcilePrediction(state, stored);
		if (stored.value.predictedConflictHold !== undefined) {
			return stored;
		}
		if (stored.value.step === "waiting") {
			stored = yield* makeDeliver(state)(stored);
			stored = (yield* releaseClosedPreparation(state, stored, yield* state.board.get(workId))) ?? stored;
		}
		stored = yield* makeHuman(state)(stored);
		const observed = yield* observeExecution(state, stored);
		if (observed.stopped) {
			return observed.stored;
		}
		stored = observed.stored;
		const answered = yield* deliverPendingAnswers(state, launch, stored);
		if (answered !== undefined) {
			return answered;
		}
		return yield* advanceObserved(state, launch)(stored);
	});
}

function advanceObserved(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.advanceObserved")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		stored = yield* makeDeliver(state)(stored);
		if (stored.value.step === "waiting") {
			stored = (yield* releaseClosedPreparation(state, stored, yield* state.board.get(stored.value.workId))) ?? stored;
		}
		stored = yield* reconcileBrief(state, stored);
		return yield* advanceExecution(state, launch)(stored);
	});
}

function advanceExecution(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.advanceExecution")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		if (["done", "released", "queued", "waiting"].includes(stored.value.step)) {
			return stored;
		}
		const work = yield* state.board.get(stored.value.workId);
		yield* authorizeBriefContext(stored.value, work);
		if (stored.value.step === "adopting") {
			stored = yield* makeAdopt(state)(stored, work);
			stored = yield* reconcilePrediction(state, stored);
		}
		if (stored.value.predictedConflictHold !== undefined) {
			return stored;
		}
		stored = yield* makeDeliver(state)(stored);
		stored = yield* makeReview(state)(stored, work);
		stored = yield* holdPredictedReview(state, stored);
		if (stored.value.predictedConflictHold !== undefined) {
			return stored;
		}
		const repair = yield* advanceRepair(state, launch, stored, "review");
		if (repair !== undefined) {
			return repair;
		}
		stored = yield* makeValidate(state)(stored, work);
		const checkRepair = yield* advanceRepair(state, launch, stored, "checks");
		if (checkRepair !== undefined) {
			return checkRepair;
		}
		return yield* makeDeliver(state)(stored).pipe(Effect.flatMap(closeDecisions(state)));
	});
}

const advanceRepair = Effect.fn("Fleet.advanceRepair")(function* (
	state: EngineState,
	launch: ReturnType<typeof makeLaunch>,
	input: Versioned<FleetRecord>,
	source: "review" | "checks",
) {
	if (input.value.step !== "repairing") {
		return undefined;
	}
	const stored = yield* makeDeliver(state)(input);
	const prompt =
		source === "review"
			? (stored.value.checks?.repairPrompt ?? stored.value.review?.repairPrompt ?? stored.value.prompt)
			: (stored.value.checks?.repairPrompt ?? "Fix required checks");
	return stored.value.step === "released" ? stored : yield* launch(stored, "repair", prompt);
});

import { Effect } from "effect";
import { validateReview } from "#completion.ts";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import { obtainReview } from "#engine/obtainReview.ts";
import { readOrContinueReview } from "#engine/readOrContinueReview.ts";
import { refreshReviewResult } from "#engine/refreshReviewResult.ts";
import { retryTerminal } from "#engine/retryTerminal.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork, Review, WorkResult } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function makeReview(state: EngineState) {
	const { sessions, load, save, decision } = state;
	return Effect.fn("Fleet.makeReview")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		const result = stored.value.result;
		if (result === undefined || stored.value.stage !== "reviewing") {
			return stored;
		}
		yield* authorizeBriefContext(stored.value, work);
		if (stored.value.launchRetry !== undefined && state.policy.now() < stored.value.launchRetry.retryAt) {
			return stored;
		}
		const receipt = yield* obtainReview(state)(stored, work, result);
		stored = yield* load(stored.value.workId);
		const observation = yield* sessions.observe(receipt);
		const attempts = recordObservation(stored.value.attempts, observation);
		stored = yield* save(stored, { ...stored.value, attempts, blocker: undefined });
		if (["accepted", "running"].includes(observation.execution)) {
			return stored;
		}
		const currentWork = yield* state.board.get(work.workId);
		yield* authorizeBriefContext(stored.value, currentWork);
		if (observation.execution !== "completed") {
			if (yield* retryTerminal(state, stored.value, observation)) {
				return yield* load(stored.value.workId);
			}
			return yield* decision(
				stored,
				"reviewer-terminal",
				`Reviewer turn ${observation.execution}`,
				"Inspect terminal reviewer evidence before retrying",
			);
		}
		const review = yield* readOrContinueReview(state)(stored, work, result, receipt, observation.output);
		if (review === undefined) {
			return yield* load(stored.value.workId);
		}
		return yield* finishReview(state)(stored, work, result, review);
	});
}

function recordObservation(attempts: readonly Attempt[], observation: SessionObservation): readonly Attempt[] {
	const { receipt } = observation;
	return attempts.map((attempt) =>
		attempt.receipt?.turnId === receipt.turnId && attempt.receipt.sessionId === receipt.sessionId
			? { ...attempt, output: observation.output, status: observation.execution }
			: attempt,
	);
}

function finishReview(state: EngineState) {
	const { save } = state;
	return Effect.fn("Fleet.finishReview")(function* (stored: Versioned<FleetRecord>, work: BoardWork, result: WorkResult, review: Review) {
		yield* validateReview(stored.value, review, result.head);
		const reviewed = yield* save(stored, { ...stored.value, review });
		const refreshed = yield* refreshReviewResult(state)(reviewed, work, result);
		if (refreshed.value.result?.head !== review.head || refreshed.value.stage !== "reviewing") {
			return refreshed;
		}
		return yield* save(refreshed, { ...refreshed.value, stage: review.verdict === "changes" ? "repairing" : "validating" });
	});
}

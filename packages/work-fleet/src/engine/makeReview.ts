import { Effect } from "effect";
import { validateReview } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import { obtainReview } from "#engine/obtainReview.ts";
import { refreshReviewResult } from "#engine/refreshReviewResult.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { readReviewerVerdict } from "#prompt/reviewer.ts";
import type { Versioned } from "#storage/model.ts";

export function makeReview(state: EngineState) {
	const { sessions, load, save, decision } = state;
	return Effect.fn("Fleet.makeReview")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		const result = stored.value.result;
		if (result === undefined || stored.value.stage !== "reviewing") {
			return stored;
		}
		if (work.revision !== stored.value.boardRevision) {
			return yield* decision(stored, "Board context changed during review", "Approve and prepare the current task and criteria");
		}
		const receipt = yield* obtainReview(state)(stored, work, result);
		stored = yield* load(stored.value.workId);
		const observation = yield* sessions.observe(receipt);
		const attempts = stored.value.attempts.map((attempt) =>
			attempt.receipt?.turnId === receipt.turnId && attempt.receipt.sessionId === receipt.sessionId
				? { ...attempt, output: observation.output, status: observation.execution }
				: attempt,
		);
		stored = yield* save(stored, { ...stored.value, attempts, blocker: undefined });
		if (["accepted", "running"].includes(observation.execution)) {
			return stored;
		}
		if (observation.execution !== "completed") {
			return yield* decision(stored, `Reviewer turn ${observation.execution}`, "Inspect terminal reviewer evidence before retrying");
		}
		const review = yield* readReviewerVerdict(observation.output, receipt);
		yield* validateReview(stored.value, review, result.head);
		stored = yield* save(stored, { ...stored.value, review });
		stored = yield* refreshReviewResult(state)(stored, work, result);
		if (stored.value.result?.head !== review.head || stored.value.stage !== "reviewing") {
			return stored;
		}
		return yield* save(stored, { ...stored.value, stage: review.verdict === "changes" ? "repairing" : "validating" });
	});
}

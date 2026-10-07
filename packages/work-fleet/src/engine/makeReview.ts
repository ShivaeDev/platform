import { Effect } from "effect";
import { validateReview } from "#completion.ts";
import type { EngineState } from "#engine/makeState.ts";
import { obtainReview } from "#engine/obtainReview.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function makeReview(state: EngineState) {
	const { sessions, load, save, decision } = state;
	return Effect.fn("Fleet.makeReview")(function* (input: Versioned<FleetRecord>, work: BoardWork) {
		let stored = input;
		const result = stored.value.result;
		if (result === undefined) {
			return stored;
		}
		const head = result.head;
		if (stored.value.stage !== "reviewing") {
			return stored;
		}
		const review = yield* obtainReview(state)(stored, work, result);
		yield* validateReview(stored.value, review, head);
		stored = yield* load(stored.value.workId);
		const observation = yield* sessions.observe(review.receipt);
		if (observation.receipt.sessionId !== review.receipt.sessionId || observation.receipt.turnId !== review.receipt.turnId) {
			return yield* decision(stored, "Reviewer observation changed exact receipt", "Inspect this review operation");
		}
		const reviewAttempts = stored.value.attempts.map((attempt, index) =>
			index === stored.value.attempts.length - 1
				? { ...attempt, output: observation.output, receipt: review.receipt, sessionId: review.receipt.sessionId, status: observation.execution }
				: attempt,
		);
		stored = yield* save(stored, { ...stored.value, attempts: reviewAttempts, blocker: undefined, review });
		if (["accepted", "running"].includes(observation.execution)) {
			return stored;
		}
		if (observation.execution !== "completed") {
			return yield* decision(stored, `Reviewer turn ${observation.execution}`, "Inspect terminal reviewer evidence before retrying");
		}
		stored = yield* save(stored, { ...stored.value, blocker: undefined, review, stage: review.verdict === "changes" ? "repairing" : "validating" });
		return stored;
	});
}

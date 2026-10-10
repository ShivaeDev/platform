import { Effect } from "effect";
import { admit } from "#admit.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { BoardWork, WorkResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";
export function obtainReview({ store, policy, integrations, save, board }: EngineState) {
	return Effect.fn("Fleet.obtainReview")(function* (stored: Versioned<FleetRecord>, work: BoardWork, result: WorkResult) {
		if (stored.value.review !== undefined) {
			return stored.value.review;
		}
		const previous = stored.value.attempts.at(-1);
		if (previous?.role === "reviewer") {
			return yield* integrations.reconcileReview(work, result, previous.operationId);
		}
		const attempt: Attempt = { operationId: policy.operationId(), role: "reviewer", status: "submitting", submittedAt: policy.now() };
		const quota = yield* policy.refreshQuota === undefined ? Effect.succeed(policy.quota) : policy.refreshQuota();
		yield* admit(
			work,
			(yield* store.list()).map(({ value }) => value),
			{ ...policy, quota },
			board.get,
		);
		yield* save(stored, { ...stored.value, attempts: [...stored.value.attempts, attempt] }, { quota, role: "reviewer" });
		return yield* integrations.review(work, result, attempt.operationId);
	});
}

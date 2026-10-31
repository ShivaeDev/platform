import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { EngineContext } from "#engine/makeState.ts";
import { awaitHumanMerge } from "#engine/mergeReadiness.ts";
import { observeDeliveryFailure } from "#engine/observeDeliveryFailure.ts";
import { reconcileSweepHold } from "#engine/reconcileSweepHold.ts";
import { requestRework } from "#engine/requestRework.ts";
import type { FleetRecord } from "#model.ts";
import type { ChangeResult } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const queueReviewedPr = Effect.fn("Fleet.queueReviewedPr")(function* (stored: Versioned<FleetRecord>, result: typeof ChangeResult.Type) {
	const state = yield* EngineContext;
	const queue = state.integrations.queue;
	if (queue === undefined || stored.value.review?.verdict !== "approved" || stored.value.review.head !== result.head) {
		return undefined;
	}
	const held = yield* reconcileSweepHold(state, stored);
	if (held !== undefined) {
		return held;
	}
	const record = stored.value;
	const current =
		record.mergeQueue?.head === result.head
			? stored
			: yield* state.save(stored, {
					...record,
					mergeQueue: { head: result.head, status: "requested" },
				});
	const status = yield* queue(yield* state.board.get(record.workId), result, current.value.mergeQueue?.status === "queued").pipe(
		Effect.catch((error) => observeDeliveryFailure(state, current, result, error)),
	);
	if (typeof status !== "string") {
		return status;
	}
	if (status === "manual") {
		return yield* awaitHumanMerge(state, current, result.head);
	}
	if (status === "failed") {
		const checks = yield* state.integrations.checks(yield* state.board.get(record.workId), result);
		return yield* requestRework(state)(
			current,
			checks.repairPrompt
				?? "The PR left the merge queue without merging. Inspect the merge-group CI failure, fix it on the same branch, and push for fresh review and checks.",
		);
	}
	return yield* state
		.save(current, {
			...current.value,
			attentionOwner: "automation",
			blocker: status === "queued" ? "Waiting for GitHub auto-merge" : "Waiting for GitHub mergeability",
			decision: undefined,
			decisionAcknowledged: undefined,
			decisionPublished: undefined,
			mergeQueue: { head: result.head, status: status === "queued" ? "queued" : "requested" },
			mergeReadyAt: record.mergeReadyAt ?? state.policy.now(),
			mergeReadyHead: result.head,
			step: "waiting",
			supersededDecisions:
				record.decision?.published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published: record.decision.published, supersededAt: state.policy.now() }],
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
});

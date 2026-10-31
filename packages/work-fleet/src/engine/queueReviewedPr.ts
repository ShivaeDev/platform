import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { EngineContext } from "#engine/makeState.ts";
import { awaitHumanMerge } from "#engine/mergeReadiness.ts";
import { observeDeliveryFailure } from "#engine/observeDeliveryFailure.ts";
import { reconcileSweepHold } from "#engine/reconcileSweepHold.ts";
import { requestRework } from "#engine/requestRework.ts";
import type { MergeQueueResult } from "#MergeQueueResult.ts";
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
					mergeReadyAt: record.mergeReadyAt ?? state.policy.now(),
					mergeReadyHead: result.head,
				});
	const status = yield* queue(
		yield* state.board.get(record.workId),
		result,
		current.value.mergeQueue?.status === "queued",
		current.value.mergeReadyAt,
	).pipe(Effect.catch((error) => observeDeliveryFailure(state, current, result, error)));
	if (typeof status !== "string" && ("value" in status || status.status === "failed")) {
		return "value" in status
			? status
			: yield* requestRework(state)({ ...current, value: { ...current.value, mergeQueueRepair: true } }, status.repairPrompt);
	}
	if (status === "manual") {
		return yield* awaitHumanMerge(state, current, result.head);
	}
	return yield* state
		.save(current, {
			...current.value,
			attentionOwner: "automation",
			blocker: queueBlocker(status),
			decision: undefined,
			decisionAcknowledged: undefined,
			decisionPublished: undefined,
			mergeQueue: { head: result.head, status: status === "queued" || current.value.mergeQueue?.status === "queued" ? "queued" : "requested" },
			mergeReadyAt: current.value.mergeReadyAt,
			mergeReadyHead: result.head,
			step: "waiting",
			supersededDecisions:
				record.decision?.published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published: record.decision.published, supersededAt: state.policy.now() }],
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
});

function queueBlocker(status: Exclude<MergeQueueResult, { readonly status: "failed" }>) {
	if (typeof status !== "string") {
		return `Waiting for release PR #${status.releasePr.split("/").at(-1)} to merge`;
	}
	return status === "queued" ? "Waiting for GitHub auto-merge" : "Waiting for GitHub mergeability";
}

import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Delivery } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function releaseFinishedWork(state: EngineState, stored: Versioned<FleetRecord>, releaseReason: string, mergedDelivery?: Delivery) {
	const record = stored.value;
	const published = record.decision?.published;
	return state
		.save(stored, {
			...record,
			attentionOwner: undefined,
			blocker: undefined,
			decision: undefined,
			decisionAcknowledged: undefined,
			decisionPublished: undefined,
			launchRetry: undefined,
			mergedDelivery: mergedDelivery ?? record.mergedDelivery,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			outcome: undefined,
			pendingContinuation: undefined,
			releaseReason,
			step: "released",
			supersededDecisions:
				published === undefined
					? record.supersededDecisions
					: [...(record.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
		})
		.pipe(Effect.flatMap(closeDecisions(state)));
}

import { Effect } from "effect";
import { Conflict, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { workRevision } from "#board/workRevision.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

const CHANGED_BRIEF_REASON = "Board context changed";

export function briefChanged(record: FleetRecord, work: BoardWork): boolean {
	return workRevision(record.boardRevision, record.boardContext) !== workRevision(work.revision, work.context);
}

export function briefApproved(work: BoardWork): boolean {
	return work.approved;
}

export const authorizeBrief = Effect.fn("Fleet.authorizeBrief")(function* (work: BoardWork) {
	if (!briefApproved(work)) {
		return yield* withFailureContext(new Forbidden({ message: "Work is no longer approved" }), {
			attentionOwner: "maintainer",
			code: "approval-required",
		});
	}
});

export const authorizeBriefContext = Effect.fn("Fleet.authorizeBriefContext")(function* (record: FleetRecord, work: BoardWork) {
	yield* authorizeBrief(work);
	if (briefChanged(record, work)) {
		return yield* withFailureContext(new Conflict({ message: CHANGED_BRIEF_REASON }), { attentionOwner: "maintainer", code: "fleet-stale" });
	}
});

export function stopChangedBrief(state: EngineState) {
	return Effect.fn("Fleet.stopChangedBrief")(function* (stored: Versioned<FleetRecord>) {
		if (stored.value.decision?.code === "fleet-stale" && stored.value.decision.reason === CHANGED_BRIEF_REASON) {
			return stored;
		}
		const published = stored.value.decision?.published;
		const stopped = yield* state.save(stored, {
			...stored.value,
			checks: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			review: undefined,
			supersededDecisions:
				published === undefined
					? stored.value.supersededDecisions
					: [...(stored.value.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
		});
		return yield* state
			.decision(
				stopped,
				"fleet-stale",
				CHANGED_BRIEF_REASON,
				"Approve and prepare the current scope, or safely release this work",
				undefined,
				"maintainer",
			)
			.pipe(Effect.flatMap(closeDecisions(state)));
	});
}

import { Effect } from "effect";
import { Conflict, Forbidden } from "@shivaedev/contract/errors/taxonomy.ts";
import { workRevision } from "#board/workRevision.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export const CHANGED_BRIEF_REASON = "Board context changed";

export function briefChanged(record: Pick<FleetRecord, "boardRevision" | "boardContext">, work: BoardWork): boolean {
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

export const authorizeBriefContext = Effect.fn("Fleet.authorizeBriefContext")(function* (
	record: Pick<FleetRecord, "boardRevision" | "boardContext">,
	work: BoardWork,
) {
	yield* authorizeBrief(work);
	if (briefChanged(record, work)) {
		return yield* withFailureContext(new Conflict({ message: CHANGED_BRIEF_REASON }), { code: "fleet-stale" });
	}
});

export function stopChangedBrief(state: EngineState) {
	return Effect.fn("Fleet.stopChangedBrief")(function* (stored: Versioned<FleetRecord>, deliveryBlockers?: readonly string[]) {
		const work = yield* state.board.get(stored.value.workId);
		const blocker =
			deliveryBlockers === undefined ? (stored.value.blocker ?? CHANGED_BRIEF_REASON) : [CHANGED_BRIEF_REASON, ...deliveryBlockers].join("; ");
		if (
			isChangedBriefDecision(stored.value)
			&& stored.value.blocker === blocker
			&& stored.value.decision?.publicationWork !== undefined
			&& !briefChanged(
				{
					boardContext: stored.value.decision.publicationWork.context,
					boardRevision: stored.value.decision.publicationWork.revision,
				},
				work,
			)
		) {
			return stored;
		}
		const stopped = yield* state.save(stored, {
			...stored.value,
			checks: undefined,
			mergeReadyAt: undefined,
			mergeReadyHead: undefined,
			review: undefined,
		});
		const decided = yield* state.decision(
			stopped,
			"fleet-stale",
			CHANGED_BRIEF_REASON,
			"Dispatch to approve the current brief in place, retry this decision, or safely release this work",
			undefined,
			undefined,
			work,
		);
		return yield* state.save(decided, { ...decided.value, blocker });
	});
}

export function isChangedBriefDecision(record: FleetRecord): boolean {
	return record.decision?.code === "fleet-stale" && record.decision.reason === CHANGED_BRIEF_REASON;
}

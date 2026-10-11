import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { type BoardWork, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function briefChanged(record: FleetRecord, work: BoardWork): boolean {
	return record.boardContext === undefined ? record.boardRevision !== work.revision : record.boardContext !== work.context;
}

export function briefUpdate(record: FleetRecord, work: BoardWork): string {
	return `The approved worker brief changed. Continue with the current brief and adjust the work to its criteria.\n\nPrevious brief:\n${record.boardContext ?? record.prompt}\n\nCurrent brief:\n${work.context}`;
}

export function briefApproved(work: BoardWork): boolean {
	return work.approved && work.status !== "done" && work.status !== "superseded";
}

export const authorizeBrief = Effect.fn("Fleet.authorizeBrief")(function* (work: BoardWork) {
	if (!briefApproved(work)) {
		return yield* new FleetFailure({
			attentionOwner: "maintainer",
			message: "Work is no longer approved or is done or superseded",
			reason: "denied",
		});
	}
});

export function refreshBrief(state: EngineState) {
	return Effect.fn("Fleet.refreshBrief")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		yield* authorizeBrief(work);
		if (!briefChanged(stored.value, work)) {
			return stored;
		}
		return yield* state.save(stored, refreshedBrief(stored.value, work));
	});
}

export function continueChangedBrief(state: EngineState) {
	return Effect.fn("Fleet.continueChangedBrief")(function* (stored: Versioned<FleetRecord>, work: BoardWork) {
		yield* authorizeBrief(work);
		const published = stored.value.decision?.published;
		return yield* state.save(stored, {
			...changedBrief(stored.value, work),
			decision: undefined,
			decisionPublished: undefined,
			supersededDecisions:
				published === undefined
					? stored.value.supersededDecisions
					: [...(stored.value.supersededDecisions ?? []), { published, supersededAt: state.policy.now() }],
		});
	});
}

export function refreshedBrief(record: FleetRecord, work: BoardWork): FleetRecord {
	if (!briefChanged(record, work)) {
		return record;
	}
	const prompt =
		record.boardContext !== undefined && record.prompt.includes(record.boardContext)
			? record.prompt.replace(record.boardContext, work.context)
			: `${record.prompt}\n\n${briefUpdate(record, work)}`;
	return {
		...record,
		areas: work.areas,
		boardContext: work.context,
		boardRevision: work.revision,
		boardSourcePath: work.sourcePath,
		checks: undefined,
		launchRetry: undefined,
		mergeReadyAt: undefined,
		mergeReadyHead: undefined,
		prompt,
		review: undefined,
	};
}

export function changedBrief(record: FleetRecord, work: BoardWork): FleetRecord {
	const refreshed = refreshedBrief(record, work);
	return { ...refreshed, blocker: undefined, prompt: `${refreshed.prompt}\n\n${briefUpdate(record, work)}`, stage: "repairing" };
}

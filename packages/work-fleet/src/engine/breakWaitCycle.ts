import { Effect } from "effect";
import { reviewSatisfied } from "#completion.ts";
import { greenCycleMember } from "#engine/greenCycleMember.ts";
import { EngineContext } from "#engine/makeState.ts";
import type { MergePrediction } from "#MergePrediction.ts";
import { executing, type FleetRecord } from "#model.ts";
import { waitGroups } from "#scheduling/adapters/waitCycles.ts";
import { DEFAULT_AREA_MERGE_WAIT_MS, holdsAreas, overlappingArea } from "#scheduling/areas.ts";
import type { Versioned } from "#storage/model.ts";

export function orderedPrediction(record: FleetRecord, prediction: MergePrediction): MergePrediction {
	const first = record.mergeOrderFirst;
	return first?.head === prediction.head
		? {
				...prediction,
				conflicts: prediction.conflicts.map((conflict) => (first.prs.includes(conflict.otherPr) ? { ...conflict, wait: false } : conflict)),
			}
		: prediction;
}

export const breakWaitCycle = Effect.fn("Fleet.breakWaitCycle")(function* (stored: Versioned<FleetRecord>, prediction: MergePrediction) {
	const state = yield* EngineContext;
	const waits = prediction.conflicts.filter((conflict) => conflict.wait).map((conflict) => conflict.otherPr);
	if (waits.length === 0) {
		return stored;
	}
	const policy = yield* state.current;
	const snapshot = (yield* state.store.list()).map((entry) =>
		entry.value.workId === stored.value.workId
			? { ...stored, value: { ...stored.value, mergePrediction: prediction, predictedConflictHold: { head: prediction.head, prs: waits } } }
			: entry,
	);
	const records = snapshot.map((entry) => entry.value);
	function held(record: FleetRecord) {
		return holdsAreas(record, policy.now(), policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS);
	}
	const groups = waitGroups(
		records.map((record) => {
			const owner =
				record.step === "repairing" && !executing(record)
					? records.find((other) => other.workId !== record.workId && held(other) && overlappingArea(record.areas ?? [], other.areas) !== undefined)
					: undefined;
			let reason = record.blocker?.startsWith("waiting for area ") ? undefined : record.blocker;
			if (owner !== undefined) {
				reason = `waiting for area repair held by ${owner.workId}`;
			}
			return {
				item: record.workId,
				mergePrs: record.predictedConflictHold?.prs,
				pr: record.result?.kind === "change" ? record.result.pr : undefined,
				reason,
				sweepItem: record.sweepHold?.workId,
				waiting: !(executing(record) || ["done", "released"].includes(record.step)),
			};
		}),
	);
	const group = groups.find((candidates) => candidates.some((member) => member.item === stored.value.workId));
	if (group === undefined) {
		return stored;
	}
	const members = snapshot.filter(({ value }) => group.some((member) => member.item === value.workId));
	const selected = yield* greenCycleMember(members, stored.value.workId, prediction);
	if (selected !== undefined) {
		const { checks, current } = selected;
		const record = current.value;
		const prs = (record.predictedConflictHold?.prs ?? []).filter((pr) => group.some((member) => member.pr === pr));
		yield* state.save(current, {
			...record,
			attentionOwner: undefined,
			blocker: undefined,
			checks,
			mergeOrderFirst: {
				head: checks.head,
				prs: [...new Set([...(record.mergeOrderFirst?.head === checks.head ? record.mergeOrderFirst.prs : []), ...prs])],
			},
			predictedConflictHold: undefined,
			step: reviewSatisfied(record, checks.head) ? "validating" : "reviewing",
		});
		return yield* state.load(stored.value.workId);
	}
	const lenders = members.filter(
		({ value }) =>
			value.step !== "repairing"
			&& held(value)
			&& members.some(({ value: repair }) => repair.step === "repairing" && overlappingArea(repair.areas ?? [], value.areas) !== undefined),
	);
	for (const current of lenders) {
		yield* state.save(current, { ...current.value, mergeAreasReleased: true });
	}
	if (lenders.length > 0) {
		for (const current of members.filter(({ value }) => value.step === "repairing" && value.blocker?.startsWith("waiting for area "))) {
			yield* state.save(current, { ...current.value, attentionOwner: undefined, blocker: undefined });
		}
	}
	return yield* state.load(stored.value.workId);
});

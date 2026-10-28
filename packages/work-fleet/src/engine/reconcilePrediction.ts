import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";
import { requestRework } from "#engine/requestRework.ts";
import { publishedPr, watchedPrs } from "#engine/watchedPrs.ts";
import type { MergePrediction } from "#MergePrediction.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const reconcilePrediction = Effect.fn("Fleet.reconcilePrediction")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	const record = stored.value;
	if (state.integrations.predict === undefined || record.step === "adopting") {
		return stored;
	}
	const pr = yield* publishedPr(state, record);
	if (pr === undefined) {
		return stored;
	}
	const prediction = yield* state.integrations.predict(pr, [...(yield* watchedPrs(state)), ...(record.predictedConflictHold?.prs ?? [])]);
	if (!canHold(record)) {
		return yield* state.save(stored, { ...record, mergePrediction: prediction });
	}
	return yield* applyPrediction(state, stored, prediction);
});

const applyPrediction = Effect.fn("Fleet.applyPrediction")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	prediction: MergePrediction,
) {
	const record = stored.value;
	const waits = prediction.conflicts.filter((conflict) => conflict.wait);
	if (waits.length > 0) {
		const reason = waits.map((conflict) => `waiting for ${conflict.otherPr} to merge: conflicting ${conflict.files.join(", ")}`).join("; ");
		return yield* state
			.save(stored, {
				...record,
				attentionOwner: "automation",
				blocker: reason,
				checks: undefined,
				decision: undefined,
				decisionAcknowledged: undefined,
				decisionPublished: undefined,
				mergeAreasReleased: true,
				mergePrediction: prediction,
				mergeReadyAt: undefined,
				mergeReadyHead: undefined,
				predictedConflictHold: { head: prediction.head, prs: waits.map((conflict) => conflict.otherPr) },
				review: undefined,
				step: "reviewing",
				supersededDecisions:
					record.decision?.published === undefined
						? record.supersededDecisions
						: [...(record.supersededDecisions ?? []), { published: record.decision.published, supersededAt: state.policy.now() }],
			})
			.pipe(Effect.flatMap(closeDecisions(state)));
	}
	const value = {
		...record,
		...(record.predictedConflictHold === undefined ? {} : { attentionOwner: undefined, blocker: undefined }),
		mergePrediction: prediction,
		predictedConflictHold: undefined,
	};
	const merged = record.predictedConflictHold?.prs.filter((pr) => prediction.mergedPrs.includes(pr)) ?? [];
	return merged.length === 0
		? yield* state.save(stored, value)
		: yield* requestRework(state)(
				{ ...stored, value },
				`${merged.join(", ")} merged after a predicted conflict hold. Fetch and merge main once at ${prediction.mainRevision}, resolve the conflicts, and retain the requested changes.`,
				undefined,
				prediction.mainRevision,
			);
});

export function holdPredictedReview(state: EngineState, stored: Versioned<FleetRecord>) {
	const prediction = stored.value.mergePrediction;
	return prediction?.conflicts.some((conflict) => conflict.wait) && canHold(stored.value)
		? applyPrediction(state, stored, prediction)
		: Effect.succeed(stored);
}

function canHold(record: FleetRecord) {
	return (
		!executing(record)
		&& record.result?.kind === "change"
		&& (["reviewing", "validating", "delivering"].includes(record.step) || record.decision?.code === "reviewed-pr-ready")
	);
}

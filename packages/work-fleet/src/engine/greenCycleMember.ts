import { Effect } from "effect";
import { EngineContext } from "#engine/makeState.ts";
import type { MergePrediction } from "#MergePrediction.ts";
import type { FleetRecord } from "#model.ts";
import type { Checks } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

function mergeable(prediction: MergePrediction, head: string) {
	return prediction.head === head && !prediction.conflicts.some((conflict) => conflict.otherPr === "main");
}

function green(checks: Checks, head: string) {
	return checks.head === head && checks.passed && !checks.pending && checks.evidence.length > 0;
}

export const greenCycleMember = Effect.fn("Fleet.greenCycleMember")(function* (
	members: readonly Versioned<FleetRecord>[],
	workId: string,
	prediction: MergePrediction,
) {
	const state = yield* EngineContext;
	for (const current of members) {
		const record = current.value;
		const result = record.result;
		if (result?.kind !== "change" || record.predictedConflictHold === undefined) {
			continue;
		}
		let observed = prediction;
		if (record.workId !== workId) {
			if (state.integrations.predict === undefined) {
				continue;
			}
			observed = yield* state.integrations.predict(
				result.pr,
				members.flatMap(({ value }) => (value.result?.kind === "change" ? [value.result.pr] : [])),
			);
		}
		if (!mergeable(observed, result.head)) {
			continue;
		}
		const checks = yield* state.integrations.checks(yield* state.board.get(record.workId), result);
		if (green(checks, result.head)) {
			return { checks, current };
		}
	}
	return undefined;
});

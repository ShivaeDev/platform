import { Effect, Option } from "effect";
import { reviewSatisfied } from "#completion.ts";
import { EngineContext, type EngineState } from "#engine/makeState.ts";
import { publishedPr } from "#engine/watchedPrs.ts";
import type { MergePrediction } from "#MergePrediction.ts";
import { executing, type FleetRecord } from "#model.ts";

export const orderMergePrediction = Effect.fn("Fleet.orderMergePrediction")(function* (record: FleetRecord, prediction: MergePrediction) {
	const state = yield* EngineContext;
	if (prediction.conflicts.length === 0) {
		return prediction;
	}
	const records = (yield* state.store.list()).map(({ value }) => value);

	const ownRank = yield* mergeRank(state, record, prediction);
	const conflicts = yield* Effect.forEach(prediction.conflicts, (conflict) =>
		Effect.gen(function* () {
			const other = records.find((candidate) => candidate.result?.kind === "change" && candidate.result.pr === conflict.otherPr);
			if (state.integrations.predict === undefined || conflict.otherPr === "main") {
				return conflict;
			}
			if (other === undefined) {
				const fleetOwned = ownRank >= 2 && (yield* pendingFleetPr(state, records, conflict.otherPr));
				return fleetOwned ? { ...conflict, wait: false } : conflict;
			}
			const observed = yield* state.integrations.predict(conflict.otherPr, []);
			const otherRank = yield* mergeRank(state, other, observed);
			return ownRank === otherRank ? conflict : { ...conflict, wait: otherRank > ownRank };
		}),
	);
	return { ...prediction, conflicts };
});

const mergeRank = Effect.fn("Fleet.mergeRank")(function* (state: EngineState, candidate: FleetRecord, observed: MergePrediction) {
	const result = candidate.result;
	if (
		result?.kind !== "change"
		|| executing(candidate)
		|| observed.head !== result.head
		|| observed.conflicts.some((conflict) => conflict.otherPr === "main")
	) {
		return 0;
	}
	const checks = yield* state.integrations.checks(yield* state.board.get(candidate.workId), result);
	if (checks.head !== result.head || !checks.passed || checks.pending || checks.evidence.length === 0) {
		return 0;
	}
	return reviewSatisfied(candidate, result.head) ? 2 : 1;
});

const pendingFleetPr = Effect.fn("Fleet.pendingFleetPr")(function* (state: EngineState, records: readonly FleetRecord[], pr: string) {
	const pending = yield* Effect.findFirst(
		records.filter((candidate) => candidate.result === undefined),
		(candidate) => publishedPr(state, candidate).pipe(Effect.map((published) => published === pr)),
	);
	return Option.isSome(pending);
});

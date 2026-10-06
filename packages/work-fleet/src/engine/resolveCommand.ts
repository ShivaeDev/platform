import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
export function resolveCommand({ board, policy, load, save, store }: EngineState) {
	return Effect.fn("Fleet.resolve")(function* (workId: string, decisionId: string, action: "retry" | "release") {
		const stored = yield* load(workId);
		if (stored.value.decision?.id !== decisionId) {
			return yield* Effect.fail(new FleetFailure({ message: "Decision changed", reason: "stale" }));
		}
		const work = yield* board.get(workId);
		if (policy.approved[workId] !== work.revision) {
			return yield* Effect.fail(new FleetFailure({ message: "Decision cannot grant execution or delivery authority", reason: "denied" }));
		}
		if (action === "release" && executing(stored.value)) {
			return yield* Effect.fail(new FleetFailure({ message: "Confirm terminal execution before releasing ownership", reason: "denied" }));
		}
		if (action === "release" && stored.value.deliverySubmitted && stored.value.outcome === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Reconcile the submitted delivery before releasing ownership", reason: "denied" }));
		}
		if (action === "release" && stored.value.result?.kind === "change") {
			yield* store.reserveForeign(stored.value.result.pr, stored.value.result.paths, { backlog: true, executing: false });
		}
		const stage = resolutionStage(stored.value, action);
		return yield* save(stored, { ...stored.value, decision: undefined, stage });
	});
}

function resolutionStage(record: FleetRecord, action: "retry" | "release"): FleetRecord["stage"] {
	if (action === "release") {
		return "released";
	}
	if (record.deliverySubmitted && !executing(record)) {
		return "delivering";
	}
	if (record.attempts.at(-1)?.role === "reviewer") {
		return "reviewing";
	}
	if (executing(record)) {
		return "executing";
	}
	if (record.deliverySubmitted) {
		return "delivering";
	}
	return record.result === undefined ? "prepared" : "reviewing";
}

import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export const authorizeResolution = Effect.fn("Fleet.authorizeResolution")(function* (
	{ board, policy, store }: EngineState,
	record: FleetRecord,
	action: "retry" | "release",
) {
	const work = yield* board.get(record.workId);
	if (policy.approved[record.workId] !== work.revision) {
		return yield* Effect.fail(new FleetFailure({ message: "Decision cannot grant execution or delivery authority", reason: "denied" }));
	}
	if (action !== "release") {
		return;
	}
	if (executing(record)) {
		return yield* Effect.fail(new FleetFailure({ message: "Confirm terminal execution before releasing ownership", reason: "denied" }));
	}
	if (record.deliverySubmitted && record.outcome === undefined) {
		return yield* Effect.fail(new FleetFailure({ message: "Reconcile the submitted delivery before releasing ownership", reason: "denied" }));
	}
	if (record.result?.kind === "change") {
		yield* store.reserveForeign(record.result.pr, record.result.paths, { backlog: true, executing: false, preservePaths: true });
	}
});

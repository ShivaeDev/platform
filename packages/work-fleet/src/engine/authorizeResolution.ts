import { Effect } from "effect";
import { authorizeBriefContext } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export const authorizeResolution = Effect.fn("Fleet.authorizeResolution")(function* (
	state: EngineState,
	record: FleetRecord,
	action: "retry" | "release",
) {
	if (action === "retry") {
		const work = yield* state.board.get(record.workId);
		yield* authorizeBriefContext(record, work);
		return;
	}
	if (executing(record)) {
		return yield* Effect.fail(new FleetFailure({ message: "Confirm terminal execution before releasing ownership", reason: "denied" }));
	}
	if (record.result?.kind === "change") {
		yield* state.store.reserveForeign(record.result.pr, { backlog: true, executing: false });
	}
});

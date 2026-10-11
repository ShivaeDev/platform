import { Effect } from "effect";
import { authorizeBrief } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reserveReleasedResult } from "#engine/reserveReleasedResult.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export const authorizeResolution = Effect.fn("Fleet.authorizeResolution")(function* (
	state: EngineState,
	record: FleetRecord,
	action: "retry" | "release",
) {
	if (action === "retry") {
		const work = yield* state.board.get(record.workId);
		yield* authorizeBrief(work);
		return;
	}
	if (executing(record)) {
		return yield* Effect.fail(new FleetFailure({ message: "Confirm terminal execution before releasing ownership", reason: "denied" }));
	}
	yield* reserveReleasedResult(state, record);
});

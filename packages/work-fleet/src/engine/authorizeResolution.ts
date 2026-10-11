import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export const authorizeResolution = Effect.fn("Fleet.authorizeResolution")(function* (
	{ board, store }: EngineState,
	record: FleetRecord,
	action: "retry" | "release",
) {
	if (action === "retry") {
		const work = yield* board.get(record.workId);
		if (!work.approved) {
			return yield* Effect.fail(new FleetFailure({ message: "Decision cannot grant execution or delivery authority", reason: "denied" }));
		}
		if (work.revision !== record.boardRevision || (work.sourcePath !== record.boardSourcePath && record.boardSourcePath !== undefined)) {
			return yield* Effect.fail(new FleetFailure({ message: "Approve and prepare the current Board scope before retrying", reason: "stale" }));
		}
		return;
	}
	if (executing(record)) {
		return yield* Effect.fail(new FleetFailure({ message: "Confirm terminal execution before releasing ownership", reason: "denied" }));
	}
	if (record.result?.kind === "change") {
		yield* store.reserveForeign(record.result.pr, { backlog: true, executing: false });
	}
});

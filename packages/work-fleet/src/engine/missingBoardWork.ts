import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { releaseFinishedWork } from "#engine/releaseFinishedWork.ts";
import { executing, type FleetRecord } from "#model.ts";
import { BoardFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function missingBoardItem(error: unknown, workId?: string): boolean {
	return error instanceof BoardFailure && error.code === "board-item-missing" && (workId === undefined || error.workId === workId);
}

export const releaseMissingBoardWork = Effect.fn("Fleet.releaseMissingBoardWork")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	error: unknown,
) {
	const record = stored.value;
	if (!missingBoardItem(error, record.workId) || ["done", "released"].includes(record.step) || executing(record)) {
		return undefined;
	}
	const released = yield* releaseFinishedWork(state, stored, `Board item no longer exists: ${record.workId}`);
	yield* Effect.logInfo("Fleet released missing Board item").pipe(Effect.annotateLogs({ workId: record.workId }));
	return released;
});

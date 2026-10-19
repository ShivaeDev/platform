import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function boardCompletionAction(record: FleetRecord) {
	if (record.stage === "completed" && record.report !== undefined) {
		return "Done; report recorded.";
	}
	if (record.stage === "completed" && record.result?.kind === "no-change") {
		return "Done; no change needed.";
	}
	if (record.stage !== "completed" && !(record.stage === "released" && /^PR #\d+ merged by a human /u.test(record.releaseReason ?? ""))) {
		return;
	}
	if (record.result?.kind !== "change") {
		return;
	}
	const number = record.result.prNumber ?? /\/(?<number>\d+)\/?$/u.exec(record.result.pr)?.groups?.number;
	return number === undefined ? undefined : `Done; PR #${number} merged.`;
}

export function completeBoardWork(state: EngineState) {
	return Effect.fn("Fleet.completeBoardWork")(function* (stored: Versioned<FleetRecord>) {
		const action = boardCompletionAction(stored.value);
		if (action !== undefined && stored.value.boardSourcePath !== undefined && state.board.complete !== undefined) {
			yield* state.board
				.complete(stored.value.workId, stored.value.boardSourcePath, action)
				.pipe(Effect.catchTag("BoardFailure", (error) => Effect.logWarning(error.message)));
		}
		if (state.board.closeFinishedDecisions !== undefined) {
			yield* state.board
				.closeFinishedDecisions({ workId: stored.value.workId })
				.pipe(Effect.catchTag("BoardFailure", (error) => Effect.logWarning(error.message)));
		}
		return stored;
	});
}

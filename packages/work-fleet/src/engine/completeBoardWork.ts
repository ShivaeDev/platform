import { Effect } from "effect";
import { briefChanged } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export function boardCompletionAction(record: FleetRecord) {
	if (record.step === "done" && record.report !== undefined) {
		return "Done; report recorded.";
	}
	if (record.step === "done" && record.result?.kind === "no-change") {
		return "Done; no change needed.";
	}
	if (record.step !== "done" && !(record.step === "released" && /^PR #\d+ merged by a human /u.test(record.releaseReason ?? ""))) {
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
		const complete = state.board.complete;
		const sourcePath = stored.value.boardSourcePath;
		if (action !== undefined && sourcePath !== undefined && complete !== undefined) {
			yield* state.board.get(stored.value.workId).pipe(
				Effect.flatMap((work) => (briefChanged(stored.value, work) ? Effect.void : complete(stored.value.workId, sourcePath, action))),
				Effect.catchTag("BoardFailure", (error) => Effect.logWarning(error.message)),
			);
		}
		if (state.board.closeFinishedDecisions !== undefined) {
			yield* state.board
				.closeFinishedDecisions({ workId: stored.value.workId })
				.pipe(Effect.catchTag("BoardFailure", (error) => Effect.logWarning(error.message)));
		}
		return stored;
	});
}

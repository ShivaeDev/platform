import { Deferred, Effect } from "effect";
import { completionEdit } from "#test/completionEdit.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { MOVED } from "#test/githubResult.ts";
import { mainObservation } from "#test/preparation.ts";

export function boardEditRacesCompletion() {
	return engineConfiguration("a human Board edit races completion bookkeeping", (state) => {
		state.completionEdit = undefined;
		function applyEdit() {
			state.completionEdit?.();
			state.completionEdit = undefined;
		}
		return {
			decorateBoard: (board) => completionEdit(board, applyEdit),
		};
	});
}
export function workClosesDuringAssessment() {
	return engineConfiguration("Board work can close during main assessment", (state) => {
		state.closeDuringAssessment = undefined;
		return {
			mainQuery: (preparation) =>
				Effect.sync(() => state.closeDuringAssessment?.()).pipe(Effect.as(mainObservation({ fromRevision: preparation.baseRevision }))),
		};
	});
}
export function scopeApproval(timing: "between review passes" | "while the reviewer finishes") {
	return engineConfiguration("Board approval is removed during independent review", (state) =>
		Effect.gen(function* () {
			const observing = yield* Deferred.make<void>();
			const resume = yield* Deferred.make<void>();
			const betweenPasses = timing === "between review passes";

			state.observing = observing;
			state.reviewResume = resume;
			return {
				reviewGate: betweenPasses ? Effect.void : Deferred.succeed(observing, undefined).pipe(Effect.andThen(Deferred.await(resume))),
				reviewRunning: betweenPasses,
			};
		}),
	);
}
export function movedHeadWriteIsInterrupted() {
	return engineConfiguration("the moved-head write pauses before the new reviewer starts", (state) =>
		Effect.gen(function* () {
			const launching = yield* Deferred.make<void>();
			state.movedWriteResumed = false;
			state.launching = launching;
			return {
				reviewRunning: true,
				writeGate: (record) =>
					!state.movedWriteResumed && record.attempts.at(-1)?.reviewHead === MOVED
						? Deferred.succeed(launching, undefined).pipe(Effect.andThen(Effect.never))
						: Effect.void,
			};
		}),
	);
}

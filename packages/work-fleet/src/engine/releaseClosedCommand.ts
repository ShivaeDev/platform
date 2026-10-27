import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { retryOrRelease } from "#engine/applyResolution.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import type { EngineState } from "#engine/makeState.ts";

// A closed Board decision accepts no response, so release applies without one; an open decision keeps its Board answer path.
export function releaseClosedCommand(state: EngineState) {
	return Effect.fn("Fleet.releaseClosed")(
		function* (workId: string, decisionId: string) {
			const stored = yield* state.load(workId);
			const decision = stored.value.decision;
			if (stored.value.step !== "waiting" || decision?.id !== decisionId) {
				return yield* new Conflict({ message: "Decision changed" });
			}
			if (decision.published === undefined || (yield* state.board.readDecision(decision.published))._tag !== "Closed") {
				return undefined;
			}
			return yield* retryOrRelease(state)(stored, "release", stored.value.responses ?? [], "").pipe(Effect.flatMap(closeDecisions(state)));
		},
		(effect) => effect.pipe(Effect.catchTag("StorageConflict", () => Effect.fail(new Conflict({ message: "Decision changed" })))),
	);
}

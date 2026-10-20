import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { BoardWork, WorkResult } from "#policy.ts";

export function reviewChecks(state: EngineState, work: BoardWork, result: WorkResult) {
	return state.integrations.checks(work, result, "review").pipe(Effect.catch((error) => Effect.succeed({ unavailable: error.message })));
}

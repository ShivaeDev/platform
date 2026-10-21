import { Effect } from "effect";
import { makeObserve } from "#engine/makeObserve.ts";
import type { EngineState } from "#engine/makeState.ts";
import { missingAcceptedTurn, recoverMissingTurn } from "#engine/recoverMissingTurn.ts";
import { reconcileBrief } from "#engine/refreshBrief.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const observeExecution = Effect.fn("Fleet.observeExecution")(function* (state: EngineState, input: Versioned<FleetRecord>) {
	let stored = input;
	if (stored.value.step === "working" && stored.value.attempts.at(-1)?.receipt === undefined) {
		stored = yield* reconcileBrief(state, stored);
		if (stored.value.step === "waiting") {
			return { stopped: true, stored };
		}
	}
	stored = yield* makeObserve(state)(stored).pipe(
		Effect.catch((error) =>
			Effect.gen(function* () {
				const current = yield* state.load(stored.value.workId);
				if (missingAcceptedTurn(error) && current.value.step !== "waiting") {
					const recovered = yield* recoverMissingTurn(state, current, undefined, error.threadIdle);
					if (recovered !== undefined) {
						return recovered;
					}
				}
				return yield* Effect.fail(error);
			}),
		),
	);
	return { stopped: false, stored };
});

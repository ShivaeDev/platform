import { Effect } from "effect";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { makeAdopt } from "#engine/makeAdopt.ts";
import { makeDeliver } from "#engine/makeDeliver.ts";
import { makeHuman } from "#engine/makeHuman.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import { makeObserve } from "#engine/makeObserve.ts";
import { makeReview } from "#engine/makeReview.ts";
import type { EngineState } from "#engine/makeState.ts";
import { makeValidate } from "#engine/makeValidate.ts";
export function makeAdvance(state: EngineState, launch: ReturnType<typeof makeLaunch>) {
	return Effect.fn("Fleet.advance")(function* (workId: string) {
		let stored = yield* state.load(workId);
		stored = yield* closeDecisions(state)(stored);
		stored = yield* makeHuman(state)(stored);
		if (["completed", "released", "prepared", "needs-human"].includes(stored.value.stage)) {
			return stored;
		}
		stored = yield* makeObserve(state)(stored);
		const work = yield* state.board.get(workId);
		stored = yield* makeAdopt(state)(stored, work);
		stored = yield* makeReview(state)(stored, work);
		if (stored.value.stage === "repairing") {
			return yield* launch(stored, "repair", stored.value.checks?.repairPrompt ?? stored.value.review?.repairPrompt ?? "Address review findings");
		}
		stored = yield* makeValidate(state)(stored, work);
		if (stored.value.stage === "repairing") {
			return yield* launch(stored, "repair", stored.value.checks?.repairPrompt ?? "Fix required checks");
		}
		return yield* makeDeliver(state)(stored, work).pipe(Effect.flatMap(closeDecisions(state)));
	});
}

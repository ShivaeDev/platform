import { Effect } from "effect";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const deliverPendingAnswers = Effect.fn("Fleet.deliverPendingAnswers")(function* (
	launch: ReturnType<typeof makeLaunch>,
	stored: Versioned<FleetRecord>,
) {
	if ((stored.value.pendingAnswers?.length ?? 0) === 0 || executing(stored.value) || ["completed", "released"].includes(stored.value.stage)) {
		return undefined;
	}
	const prompt = stored.value.stage === "repairing" ? stored.value.prompt : "Apply the following human guidance to the existing work.";
	return yield* launch(stored, "repair", prompt);
});

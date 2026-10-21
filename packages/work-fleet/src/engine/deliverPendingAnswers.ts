import { Effect } from "effect";
import { makeDeliver } from "#engine/makeDeliver.ts";
import type { makeLaunch } from "#engine/makeLaunch.ts";
import type { EngineState } from "#engine/makeState.ts";
import { reconcileBrief } from "#engine/refreshBrief.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const deliverPendingAnswers = Effect.fn("Fleet.deliverPendingAnswers")(function* (
	state: EngineState,
	launch: ReturnType<typeof makeLaunch>,
	stored: Versioned<FleetRecord>,
) {
	if ((stored.value.pendingAnswers?.length ?? 0) === 0 || executing(stored.value) || ["done", "released"].includes(stored.value.step)) {
		return undefined;
	}
	const delivered = yield* makeDeliver(state)(stored);
	if (["done", "released"].includes(delivered.value.step)) {
		return delivered;
	}
	const current = yield* reconcileBrief(state, delivered);
	return yield* launch(current, "repair", deliveryPrompt(current.value, current.value.boardRevision !== delivered.value.boardRevision));
});

function deliveryPrompt(record: FleetRecord, briefChanged: boolean) {
	if (record.step === "repairing") {
		return record.checks?.repairPrompt ?? record.review?.repairPrompt ?? record.prompt;
	}
	return briefChanged ? record.prompt : "Apply the following human guidance to the existing work.";
}

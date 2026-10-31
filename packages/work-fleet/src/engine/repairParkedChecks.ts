import { Effect } from "effect";
import { EngineContext } from "#engine/makeState.ts";
import { observeDeliveryFailure } from "#engine/observeDeliveryFailure.ts";
import { requestRework } from "#engine/requestRework.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const repairParkedChecks = Effect.fn("Fleet.repairParkedChecks")(function* (stored: Versioned<FleetRecord>) {
	const state = yield* EngineContext;
	const record = stored.value;
	const result = record.result;
	if (
		executing(record)
		|| record.decision !== undefined
		|| result?.kind !== "change"
		|| (record.predictedConflictHold === undefined && !record.blocker?.startsWith("waiting for area "))
	) {
		return stored;
	}
	const work = yield* state.board.get(record.workId);
	const status = yield* state.integrations
		.queue?.(work, result, true, record.mergeReadyAt)
		.pipe(Effect.catch((error) => observeDeliveryFailure(state, stored, result, error))) ?? Effect.succeed("pending");
	if (typeof status === "string") {
		return stored;
	}
	return "value" in status ? status : yield* requestRework(state)({ ...stored, value: { ...record, mergeQueueRepair: true } }, status.repairPrompt);
});

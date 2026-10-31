import { Effect } from "effect";
import { EngineContext } from "#engine/makeState.ts";
import { makeValidate } from "#engine/makeValidate.ts";
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
	const checks = yield* state.integrations.checks(work, result);
	if (checks.head !== result.head || checks.passed || checks.pending || checks.evidence.length === 0 || !checks.repairPrompt?.trim()) {
		return stored;
	}
	const validating = yield* state.save(stored, {
		...record,
		mergeQueue: undefined,
		mergeQueueRepair: true,
		mergeReadyAt: undefined,
		mergeReadyHead: undefined,
		predictedConflictHold: undefined,
		review: undefined,
		reviewSkippedHead: undefined,
		step: "validating",
	});
	return yield* makeValidate(state)(validating, work);
});

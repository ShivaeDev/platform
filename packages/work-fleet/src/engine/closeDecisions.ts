import { Effect, Result } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import type { FleetCycleSnapshot, FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

const ACKNOWLEDGEMENT_PREFIX = "Board request acknowledgement pending: ";
export function closeDecisions(state: EngineState) {
	return Effect.fn("Fleet.closeDecisions")(function* (initial: Versioned<FleetRecord>) {
		let stored = initial;
		const failures: string[] = [];
		for (const pending of pendingAcknowledgements(initial.value)) {
			const result = yield* state.board.acknowledgeDecision(pending.input).pipe(Effect.result);
			if (Result.isFailure(result)) {
				failures.push(`${pending.input.decision.questionId}: ${result.failure.message}`);
				continue;
			}
			const previous = stored.value.history ?? [];
			const current = pending.cycle === previous.length ? marked(stored.value, pending.response) : stored.value;
			const history = previous.map((cycle, index) => (index === pending.cycle ? marked(cycle, pending.response) : cycle));
			stored = yield* state.save(stored, { ...current, history });
		}
		if (failures.length > 0) {
			return yield* state.save(stored, { ...stored.value, blocker: `${ACKNOWLEDGEMENT_PREFIX}${failures.join("; ")}` });
		}
		if (stored.value.blocker?.startsWith(ACKNOWLEDGEMENT_PREFIX)) {
			return yield* state.save(stored, { ...stored.value, blocker: undefined });
		}
		return stored;
	});
}

function marked<T extends FleetRecord | FleetCycleSnapshot>(cycle: T, responseIndex: number | undefined): T {
	return responseIndex === undefined
		? { ...cycle, decisionAcknowledged: true }
		: {
				...cycle,
				responses: cycle.responses?.map((response, index) => (index === responseIndex ? { ...response, boardAcknowledged: true } : response)),
			};
}

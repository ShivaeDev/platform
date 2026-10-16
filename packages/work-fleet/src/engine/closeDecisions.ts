import { Effect, Result } from "effect";
import { BoardAcknowledgementStale, type BoardDecisionAcknowledgement } from "#board/schema.ts";
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
			const result = yield* closeAcknowledgement(state, pending.input).pipe(Effect.result);
			if (Result.isFailure(result)) {
				failures.push(`${pending.input.decision.questionId}: ${result.failure.message}`);
				continue;
			}
			stored = yield* state.save(stored, markedRecord(stored.value, pending, result.success));
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

interface Closure {
	readonly boardAcknowledged?: boolean;
	readonly boardAcknowledgementDisposition?: "superseded";
}

const closeAcknowledgement = Effect.fn("Fleet.closeAcknowledgement")(function* (state: EngineState, input: BoardDecisionAcknowledgement) {
	const applied = yield* state.board.acknowledgeDecision(input).pipe(Effect.result);
	if (Result.isSuccess(applied)) {
		return { boardAcknowledged: true };
	}
	if (!(applied.failure instanceof BoardAcknowledgementStale)) {
		return yield* Effect.fail(applied.failure);
	}
	const superseded =
		input.disposition === "superseded"
			? applied
			: yield* state.board.acknowledgeDecision({ ...input, disposition: "superseded", responseId: undefined }).pipe(Effect.result);
	if (Result.isFailure(superseded) && !(superseded.failure instanceof BoardAcknowledgementStale)) {
		return yield* Effect.fail(superseded.failure);
	}
	return Result.isSuccess(superseded)
		? { boardAcknowledged: true, boardAcknowledgementDisposition: "superseded" as const }
		: { boardAcknowledgementDisposition: "superseded" as const };
});

function markedRecord(record: FleetRecord, pending: ReturnType<typeof pendingAcknowledgements>[number], closure: Closure): FleetRecord {
	const previous = record.history ?? [];
	function mark<T extends FleetRecord | FleetCycleSnapshot>(value: T) {
		return marked(value, pending.response, pending.superseded, closure);
	}
	return {
		...(pending.cycle === previous.length ? mark(record) : record),
		history: previous.map((cycle, index) => (index === pending.cycle ? mark(cycle) : cycle)),
	};
}

function marked<T extends FleetRecord | FleetCycleSnapshot>(
	cycle: T,
	responseIndex: number | undefined,
	supersededIndex: number | undefined,
	closure: Closure,
): T {
	if (supersededIndex !== undefined) {
		return {
			...cycle,
			supersededDecisions: cycle.supersededDecisions?.map((receipt, index) => (index === supersededIndex ? { ...receipt, ...closure } : receipt)),
		};
	}
	return responseIndex === undefined
		? {
				...cycle,
				decision:
					closure.boardAcknowledgementDisposition === undefined || cycle.decision === undefined
						? cycle.decision
						: { ...cycle.decision, boardAcknowledgementDisposition: closure.boardAcknowledgementDisposition },
				decisionAcknowledged: closure.boardAcknowledged ?? cycle.decisionAcknowledged,
			}
		: {
				...cycle,
				responses: cycle.responses?.map((response, index) => (index === responseIndex ? { ...response, ...closure } : response)),
			};
}

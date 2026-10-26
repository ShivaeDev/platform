import { Effect } from "effect";
import type { BoardDecisionReading } from "#board/schema.ts";
import { ensureDecisionOwner } from "#engine/ensureDecisionOwner.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { EngineState } from "#engine/makeState.ts";
import { resolveCommand } from "#engine/resolveCommand.ts";
import { isFleetError } from "#errors.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure } from "#policy.ts";
import { StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";
import type { Versioned } from "#storage/model.ts";

export function makeHuman(state: EngineState) {
	return Effect.fn("Fleet.makeHuman")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		let decision = stored.value.decision;
		if (stored.value.step !== "waiting" || decision === undefined) {
			return stored;
		}
		stored = yield* ensurePublication(state)(stored);
		decision = stored.value.decision ?? decision;
		const published = stored.value.decision?.published;
		if (published === undefined) {
			return stored;
		}
		const reading = yield* state.board.readDecision(published);
		if (reading._tag === "Pending") {
			return yield* ensureDecisionOwner(state)(stored);
		}
		if (reading._tag !== "Response") {
			return yield* state.save(stored, { ...stored.value, blocker: unanswerable(reading) });
		}
		return yield* resolveCommand(state)(stored.value.workId, decision.id, reading.response.id).pipe(
			Effect.catch((error) =>
				isFleetError(error) || error instanceof BoardFailure || error instanceof StorageCapacity || error instanceof StorageQuota
					? recordAnswerFailure(state, stored, error)
					: Effect.fail(error),
			),
		);
	});
}

function unanswerable(reading: Exclude<BoardDecisionReading, { readonly _tag: "Pending" | "Response" }>) {
	switch (reading._tag) {
		case "Stale":
			return reading.reason;
		case "Closed":
			return "The Board closed this decision; release the work to hand it back";
		case "Ambiguous":
			return "Several Board answers compete; explicitly supersede the other responses";
	}
}

const recordAnswerFailure = Effect.fn("Fleet.recordAnswerFailure")(function* (state: EngineState, stored: Versioned<FleetRecord>, error: unknown) {
	yield* Effect.logError(`Failed to apply answer for ${stored.value.workId}`, error);
	return yield* state.load(stored.value.workId).pipe(
		Effect.flatMap((current) =>
			state.save(current, {
				...current.value,
				attentionOwner: current.value.decision?.id === stored.value.decision?.id ? failureOwner(error) : current.value.attentionOwner,
				blocker: `Answer failed: ${failureMessage(error)}`,
			}),
		),
		Effect.retry({ while: (failure) => failure instanceof StorageConflict }),
	);
});

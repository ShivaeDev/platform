import { Effect } from "effect";
import { ensureDecisionOwner } from "#engine/ensureDecisionOwner.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import type { EngineState } from "#engine/makeState.ts";
import { resolveCommand } from "#engine/resolveCommand.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure, FleetFailure } from "#policy.ts";
import { StorageCapacity, StorageQuota } from "#storage/errors.ts";
import type { Versioned } from "#storage/model.ts";

export function makeHuman(state: EngineState) {
	return Effect.fn("Fleet.makeHuman")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		let decision = stored.value.decision;
		if (stored.value.stage !== "needs-human" || decision === undefined) {
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
			const blocker = reading._tag === "Stale" ? reading.reason : "Several Board answers compete; explicitly supersede the other responses";
			return yield* state.save(stored, { ...stored.value, blocker });
		}
		return yield* resolveCommand(state)(stored.value.workId, decision.id, reading.response.id).pipe(
			Effect.catch((error) =>
				error instanceof FleetFailure || error instanceof BoardFailure || error instanceof StorageCapacity || error instanceof StorageQuota
					? state.save(stored, { ...stored.value, attentionOwner: failureOwner(error), blocker: failureMessage(error) })
					: Effect.fail(error),
			),
		);
	});
}

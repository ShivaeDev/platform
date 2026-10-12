import { Effect } from "effect";
import { capacityRetry } from "#engine/capacityRetry.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { SessionFailure, type SessionObservation } from "#session/schema.ts";

export const retryTerminal = Effect.fn("Fleet.retryTerminal")(function* (state: EngineState, record: FleetRecord, observation: SessionObservation) {
	const attempt = record.attempts.at(-1);
	if (observation.execution !== "failed" || attempt === undefined) {
		return false;
	}
	return yield* capacityRetry(
		state,
		record,
		attempt.operationId,
		new SessionFailure({
			capacity: observation.capacity,
			message: observation.error ?? `Provider turn ${observation.receipt.turnId} failed`,
			reason: "rejected",
		}),
	);
});

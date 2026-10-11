import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import type { SessionFailure } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

function observationFailure(error: SessionFailure) {
	return new FleetFailure({ message: error.message, reason: "integration" });
}
export const releaseExecution = Effect.fn("Fleet.releaseExecution")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	let current = stored;
	for (const attempt of stored.value.attempts) {
		if (!["submitting", "accepted", "running"].includes(attempt.status)) {
			continue;
		}
		const receipt =
			attempt.receipt
			?? (yield* state.sessions
				.reconcile({ operationId: attempt.operationId, sessionId: attempt.sessionId })
				.pipe(Effect.mapError(observationFailure)));
		current = yield* state.load(stored.value.workId);
		if (current.value.stage !== "needs-human" || current.value.decision?.id !== stored.value.decision?.id) {
			return yield* new FleetFailure({ message: "Decision changed", reason: "stale" });
		}
		const observation = yield* state.sessions.observe(receipt).pipe(Effect.mapError(observationFailure));
		const attempts = current.value.attempts.map((saved) =>
			saved.operationId === attempt.operationId ? { ...saved, output: observation.output, receipt, status: observation.execution } : saved,
		);
		current = yield* state.save(current, { ...current.value, attempts });
	}
	return current;
});

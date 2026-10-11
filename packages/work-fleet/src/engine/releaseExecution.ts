import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { releaseReceipts } from "#engine/releaseReceipts.ts";
import type { FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import type { SessionFailure, SessionObservation } from "#session/schema.ts";
import { validateReceipt } from "#session/validateReceipt.ts";
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
		const recoveredReceipts = yield* releaseReceipts(state, attempt);
		current = yield* state.load(stored.value.workId);
		if (current.value.stage !== "needs-human" || current.value.decision?.id !== stored.value.decision?.id) {
			return yield* new FleetFailure({ message: "Decision changed", reason: "stale" });
		}
		const acknowledged = current.value.attempts.find((saved) => saved.operationId === attempt.operationId) ?? attempt;
		const receipts = yield* releaseReceipts(state, { ...acknowledged, terminalReceipts: recoveredReceipts });
		current = yield* state.save(current, {
			...current.value,
			attempts: current.value.attempts.map((saved) => (saved.operationId === attempt.operationId ? { ...saved, terminalReceipts: receipts } : saved)),
		});
		const observations: SessionObservation[] = [];
		for (const receipt of receipts) {
			yield* validateReceipt(receipt, { sessionId: acknowledged.sessionId }).pipe(Effect.mapError(observationFailure));
			const observation = yield* state.sessions.observe(receipt).pipe(Effect.mapError(observationFailure));
			observations.push(observation);
		}
		if (observations.some((item) => ["accepted", "running"].includes(item.execution))) {
			return yield* new FleetFailure({ message: "Confirm terminal execution before releasing ownership", reason: "denied" });
		}
		const observation = observations[0];
		const attempts = current.value.attempts.map((saved) =>
			saved.operationId === attempt.operationId
				? {
						...saved,
						output: observations.length === 1 ? observation?.output : undefined,
						status: observations.length === 1 ? (observation?.execution ?? "interrupted") : ("failed" as const),
					}
				: saved,
		);
		current = yield* state.save(current, { ...current.value, attempts });
	}
	return current;
});

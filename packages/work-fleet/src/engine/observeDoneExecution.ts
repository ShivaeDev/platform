import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { releaseReceipts } from "#engine/releaseReceipts.ts";
import type { Attempt, FleetRecord } from "#model.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";

export function observeDoneExecution(state: EngineState) {
	return Effect.fn("Fleet.observeDoneExecution")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		for (const attempt of stored.value.attempts) {
			if (!["submitting", "accepted", "running"].includes(attempt.status) || state.launching.has(attempt.operationId)) {
				continue;
			}
			const receipts = yield* releaseReceipts(state, attempt);
			const observations = yield* Effect.forEach(receipts, (receipt) => state.sessions.observe(receipt));
			const observed = observedAttempt(attempt, observations);
			stored = yield* state.save(stored, {
				...stored.value,
				attempts: stored.value.attempts.map((saved) => (saved.operationId === attempt.operationId ? observed : saved)),
			});
		}
		return stored;
	});
}

function observedAttempt(attempt: Attempt, observations: readonly SessionObservation[]): Attempt {
	const active = observations.find((observation) => ["accepted", "running"].includes(observation.execution));
	const single = observations.length === 1 ? observations[0] : undefined;
	return {
		...attempt,
		output: single?.output,
		status: active?.execution ?? single?.execution ?? "failed",
		terminalReceipts: observations.map(({ receipt }) => receipt),
	};
}

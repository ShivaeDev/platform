import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";
export function makeObserve({ sessions, load, save, decision }: EngineState) {
	return Effect.fn("Fleet.makeObserve")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		if (stored.value.stage !== "executing") {
			return stored;
		}
		const latest = stored.value.attempts.at(-1);
		if (latest === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Execution lacks an intent", reason: "invalid" }));
		}
		const receipt =
			latest.receipt
			?? (yield* sessions.reconcile({
				operationId: latest.operationId,
				...(latest.sessionId === undefined ? {} : { sessionId: latest.sessionId }),
			}));
		stored = yield* load(stored.value.workId);
		const observation = yield* sessions.observe(receipt);
		if (observation.receipt.sessionId !== receipt.sessionId || observation.receipt.turnId !== receipt.turnId) {
			return yield* Effect.fail(new FleetFailure({ message: "Provider observation changed the exact receipt", reason: "invalid" }));
		}
		const attempts = stored.value.attempts.map((attempt) =>
			attempt.operationId === latest.operationId ? { ...attempt, output: observation.output, receipt, status: observation.execution } : attempt,
		);
		stored = yield* save(stored, { ...stored.value, attempts });
		if (["accepted", "running"].includes(observation.execution)) {
			return stored;
		}
		if (observation.execution !== "completed") {
			return yield* decision(stored, terminalReason(observation), "Inspect the terminal evidence and retry or safely release");
		}
		stored = yield* save(stored, { ...stored.value, stage: "adopting" });
		return stored;
	});
}

function terminalReason(observation: SessionObservation) {
	return `Provider turn ${observation.receipt.turnId} ${observation.execution}${observation.error === undefined ? "" : `: ${observation.error}`}`;
}

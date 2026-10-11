import { Effect, Option } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { reconcileAttempt } from "#engine/reconcileAttempt.ts";
import type { FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import { reportedQuestion } from "#prompt/worker.ts";
import type { SessionObservation } from "#session/schema.ts";
import { validateReceipt } from "#session/validateReceipt.ts";
import type { Versioned } from "#storage/model.ts";
export function makeObserve(state: EngineState) {
	const { sessions, load, save, decision, board, reportInspection } = state;
	return Effect.fn("Fleet.makeObserve")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		if (stored.value.stage !== "executing") {
			return stored;
		}
		const latest = stored.value.attempts.at(-1);
		if (latest === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Execution lacks an intent", reason: "invalid" }));
		}
		if (state.launching.has(latest.operationId)) {
			return stored;
		}
		const receipt = latest.receipt ?? (yield* reconcileAttempt(state)(stored, latest));
		stored = yield* load(stored.value.workId);
		const observation = yield* sessions.observe(receipt);
		yield* validateReceipt(observation.receipt, receipt);
		const attempts = stored.value.attempts.map((attempt) =>
			attempt.operationId === latest.operationId ? { ...attempt, output: observation.output, receipt, status: observation.execution } : attempt,
		);
		stored = yield* save(stored, { ...stored.value, attempts });
		if (["accepted", "running"].includes(observation.execution)) {
			return stored;
		}
		if (stored.value.deliverable === "report") {
			const work = yield* board.get(stored.value.workId);
			yield* Option.match(reportInspection, { onNone: () => Effect.void, onSome: (inspection) => inspection.check(work) });
		}
		if (observation.execution !== "completed") {
			return yield* decision(stored, "worker-terminal", terminalReason(observation), "Inspect the terminal evidence and retry or safely release");
		}
		const question = reportedQuestion(observation.output);
		if (question !== undefined) {
			return yield* decision(
				stored,
				"worker-question",
				question.question,
				"Record an answer to continue this worker thread",
				receipt,
				question.attentionOwner,
			);
		}
		stored = yield* save(stored, { ...stored.value, stage: "adopting" });
		return stored;
	});
}

function terminalReason(observation: SessionObservation) {
	return `Provider turn ${observation.receipt.turnId} ${observation.execution}${observation.error === undefined ? "" : `: ${observation.error}`}`;
}

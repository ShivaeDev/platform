import { Effect, Option } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { reconcileAttempt } from "#engine/reconcileAttempt.ts";
import { executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";
import { reportedQuestion } from "#prompt/worker.ts";
import type { SessionObservation } from "#session/schema.ts";
import { validateReceipt } from "#session/validateReceipt.ts";
import type { Versioned } from "#storage/model.ts";
export function makeObserve(state: EngineState) {
	const { sessions, load, save } = state;
	return Effect.fn("Fleet.makeObserve")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		const paused = pausedByBrief(stored.value);
		if (!observable(stored.value, paused)) {
			return stored;
		}
		const latest = paused
			? stored.value.attempts.findLast((attempt) => ["submitting", "accepted", "running"].includes(attempt.status))
			: stored.value.attempts.at(-1);
		if (latest === undefined) {
			return yield* Effect.fail(new FleetFailure({ message: "Execution lacks an intent", reason: "invalid" }));
		}
		if (state.launching.has(latest.operationId) || (paused && latest.receipt === undefined)) {
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
		return yield* finishObservation(state)(stored, observation, paused);
	});
}

function pausedByBrief(record: FleetRecord) {
	return record.stage === "needs-human" && record.decision?.reason === "Board context changed";
}

function observable(record: FleetRecord, paused: boolean) {
	return record.stage === "executing" || (paused && executing(record));
}

function finishObservation(state: EngineState) {
	const { board, decision, reportInspection, save } = state;
	return Effect.fn("Fleet.finishObservation")(function* (stored: Versioned<FleetRecord>, observation: SessionObservation, paused: boolean) {
		if (stored.value.deliverable === "report") {
			const work = yield* board.get(stored.value.workId);
			yield* Option.match(reportInspection, { onNone: () => Effect.void, onSome: (inspection) => inspection.check(work) });
		}
		if (paused) {
			return stored;
		}
		if (observation.execution !== "completed") {
			return yield* decision(stored, terminalReason(observation), "Inspect the terminal evidence and retry or safely release");
		}
		const question = reportedQuestion(observation.output);
		if (question !== undefined) {
			return yield* decision(
				stored,
				question.question,
				"Record an answer to continue this worker thread",
				observation.receipt,
				question.attentionOwner,
			);
		}
		return yield* save(stored, { ...stored.value, stage: "adopting" });
	});
}

function terminalReason(observation: SessionObservation) {
	return `Provider turn ${observation.receipt.turnId} ${observation.execution}${observation.error === undefined ? "" : `: ${observation.error}`}`;
}

import { Effect, Option } from "effect";
import { BadRequest } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import { observedAttempt } from "#engine/observedAttempt.ts";
import { reconcileAttempt } from "#engine/reconcileAttempt.ts";
import { recoverStall } from "#engine/recoverStall.ts";
import { recoverUnobservable } from "#engine/recoverUnobservable.ts";
import { resumeObservedStall } from "#engine/resumeStalled.ts";
import { retryTerminal } from "#engine/retryTerminal.ts";
import { type Attempt, executing, type FleetRecord } from "#model.ts";
import { reportedQuestion } from "#prompt/worker.ts";
import type { SessionObservation } from "#session/schema.ts";
import { validateReceipt } from "#session/validateReceipt.ts";
import type { Versioned } from "#storage/model.ts";
export function makeObserve(state: EngineState) {
	const { sessions, load, save } = state;
	return Effect.fn("Fleet.makeObserve")(function* (input: Versioned<FleetRecord>) {
		const current = yield* observationRecord(state, input);
		if (current === undefined) {
			return input;
		}
		let stored = current;
		const intent = yield* observationIntent(state, stored.value);
		if (intent === undefined) {
			return stored;
		}
		const { latest, paused } = intent;
		if (latest.role === "reviewer" && !paused) {
			return stored.value.step === "reviewing" ? stored : yield* save(stored, { ...stored.value, step: "reviewing" });
		}
		const receipt = latest.receipt ?? (yield* reconcileAttempt(state)(stored, latest));
		stored = yield* load(stored.value.workId);
		const observation = yield* sessions.observe(receipt);
		yield* validateReceipt(observation.receipt, receipt);
		const attempts = stored.value.attempts.map((attempt) =>
			attempt.operationId === latest.operationId ? observedAttempt(attempt, observation, state.policy.now()) : attempt,
		);
		stored = yield* save(stored, { ...stored.value, attempts, blocker: observationBlocker(stored.value, latest) });
		stored = yield* resumeObservedStall(state, stored, latest, observation);
		if (latest.role === "reviewer") {
			return stored;
		}
		return yield* advanceObservation(state, stored, observation, stored.value.step === "waiting");
	});
}

const observationIntent = Effect.fn("Fleet.observationIntent")(function* (state: EngineState, record: FleetRecord) {
	if (!observable(record)) {
		return undefined;
	}
	const paused = record.step === "waiting";
	const latest = executing(record)
		? record.attempts.findLast((attempt) => ["submitting", "accepted", "running"].includes(attempt.status))
		: record.attempts.at(-1);
	if (latest === undefined) {
		return yield* Effect.fail(new BadRequest({ message: "Execution lacks an intent" }));
	}
	return state.launching.has(latest.operationId) || (paused && latest.receipt === undefined) ? undefined : { latest, paused };
});

const observationRecord = Effect.fn("Fleet.observationRecord")(function* (state: EngineState, input: Versioned<FleetRecord>) {
	const pending = input.value.attempts.at(-1);
	if (pending !== undefined && state.launching.has(pending.operationId)) {
		return undefined;
	}
	// A completed submission persists its receipt before releasing the launching guard.
	return yield* state.load(input.value.workId);
});

function observationBlocker(record: FleetRecord, attempt: Attempt) {
	return attempt.readRetry === undefined ? record.blocker : undefined;
}

function observable(record: FleetRecord) {
	return record.step === "working" || (!["done", "released"].includes(record.step) && executing(record));
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
			if (yield* retryTerminal(state, stored.value, observation)) {
				return yield* state.load(stored.value.workId);
			}
			return yield* decision(stored, "worker-terminal", terminalReason(observation), "Inspect the terminal evidence and retry or safely release");
		}
		const question = reportedQuestion(observation.output);
		if (question !== undefined) {
			return yield* decision(
				stored,
				"worker-question",
				question.question,
				"Record an answer to continue this worker thread",
				observation.receipt,
				question.attentionOwner,
			);
		}
		return yield* save(stored, { ...stored.value, step: "adopting" });
	});
}

function terminalReason(observation: SessionObservation) {
	return `Provider turn ${observation.receipt.turnId} ${observation.execution}${observation.error === undefined ? "" : `: ${observation.error}`}`;
}

const advanceObservation = Effect.fn("Fleet.advanceObservation")(function* (
	state: EngineState,
	stored: Versioned<FleetRecord>,
	observation: SessionObservation,
	paused: boolean,
) {
	const attempt = stored.value.attempts.find(
		(entry) => entry.receipt?.turnId === observation.receipt.turnId && entry.receipt.sessionId === observation.receipt.sessionId,
	);
	const recovered =
		(yield* recoverUnobservable(state, stored, attempt, observation.progress === undefined ? undefined : observation.progress.length === 0))
		?? (yield* recoverStall(state, stored, attempt));
	if (recovered !== undefined) {
		return recovered;
	}
	return ["accepted", "running"].includes(observation.execution) ? stored : yield* finishObservation(state)(stored, observation, paused);
});

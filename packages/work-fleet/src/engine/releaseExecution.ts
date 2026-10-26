import { Effect } from "effect";
import { Conflict, Forbidden, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import { releaseReceipts } from "#engine/releaseReceipts.ts";
import type { FleetRecord } from "#model.ts";
import type { ContinueSession, SessionFailure, SessionObservation } from "#session/schema.ts";
import { validateReceipt } from "#session/validateReceipt.ts";
import type { Versioned } from "#storage/model.ts";

function missingObservation(observation: SessionObservation, singleReceipt: boolean) {
	return singleReceipt && observation.turnMissing === true && observation.progress?.length === 0;
}

function observationFailure(error: SessionFailure) {
	return new ServiceUnavailable({ message: error.message });
}

const confirmMissingObservation = Effect.fn("Fleet.confirmMissingObservation")(function* (
	state: EngineState,
	input: Pick<ContinueSession, "operationId" | "sessionId">,
	error: SessionFailure,
) {
	if (error.threadIdle === true) {
		return undefined;
	}
	if (error.threadIdle === undefined) {
		const current = yield* state.sessions.reconcile(input).pipe(Effect.result);
		if (
			current._tag === "Failure"
			&& current.failure.code === "session-turn-missing"
			&& current.failure.reason === "ambiguous"
			&& current.failure.threadIdle === true
		) {
			return undefined;
		}
	}
	return yield* observationFailure(error);
});

export const releaseExecution = Effect.fn("Fleet.releaseExecution")(function* (state: EngineState, stored: Versioned<FleetRecord>) {
	let current = stored;
	for (const attempt of stored.value.attempts) {
		if (!["submitting", "accepted", "running"].includes(attempt.status)) {
			continue;
		}
		const recoveredReceipts = yield* releaseReceipts(state, attempt);
		current = yield* state.load(stored.value.workId);
		if (current.value.step !== "waiting" || current.value.decision?.id !== stored.value.decision?.id) {
			return yield* new Conflict({ message: "Decision changed" });
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
			const observation = yield* state.sessions.observe(receipt).pipe(
				Effect.map((observed) => (missingObservation(observed, receipts.length === 1) ? undefined : observed)),
				Effect.catch((error) =>
					receipts.length === 1 && error.code === "session-turn-missing" && error.reason === "ambiguous"
						? confirmMissingObservation(state, { operationId: acknowledged.operationId, sessionId: receipt.sessionId }, error)
						: Effect.fail(observationFailure(error)),
				),
			);
			if (observation !== undefined) {
				observations.push(observation);
			}
		}
		if (observations.some((item) => ["accepted", "running"].includes(item.execution))) {
			return yield* new Forbidden({ message: "Confirm terminal execution before releasing ownership" });
		}
		const observation = observations[0];
		const attempts = current.value.attempts.map((saved) =>
			saved.operationId === attempt.operationId
				? {
						...saved,
						output: observations.length === 1 ? observation?.output : undefined,
						sessionUnusable: observations.length === 0 || saved.sessionUnusable,
						status: observations.length === 1 ? (observation?.execution ?? "interrupted") : ("failed" as const),
					}
				: saved,
		);
		current = yield* state.save(current, { ...current.value, attempts });
	}
	return current;
});

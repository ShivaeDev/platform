import { Effect } from "effect";
import { capacityRetry } from "#engine/capacityRetry.ts";
import { failureCode } from "#engine/failureCode.ts";
import type { EngineState } from "#engine/makeState.ts";
import { readRetry } from "#engine/readRetry.ts";
import type { SessionFailure } from "#session/schema.ts";
import { requestTimedOut } from "#session/transientFailure.ts";

export const submissionFailure = Effect.fn("Fleet.submissionFailure")(function* (
	state: EngineState,
	workId: string,
	operationId: string,
	error: SessionFailure,
	recommendation: string,
) {
	let current = yield* state.load(workId);
	if (current.value.decision !== undefined) {
		return;
	}
	if (requestTimedOut(error)) {
		current = yield* state.save(current, {
			...current.value,
			attempts: current.value.attempts.map((attempt) => (attempt.operationId === operationId ? { ...attempt, submissionTimedOut: true } : attempt)),
		});
	}
	if (requestTimedOut(error) || (error.reason === "ambiguous" && error.code === "session-unavailable")) {
		yield* readRetry(state, current, error, requestTimedOut(error) ? undefined : operationId);
		return;
	}
	if (error.reason !== "rejected" && error.reason !== "unavailable") {
		return;
	}
	if (yield* capacityRetry(state, current.value, operationId, error)) {
		return;
	}
	const acknowledged = current.value.attempts.find((item) => item.operationId === operationId);
	const unresolvedSession = acknowledged?.receipt !== undefined || (error.reason === "unavailable" && acknowledged?.sessionId !== undefined);
	const attempts = current.value.attempts.map((item) =>
		item.operationId === operationId && !unresolvedSession ? { ...item, status: "failed" as const } : item,
	);
	yield* state.decision(
		yield* state.save(current, { ...current.value, attempts }),
		failureCode(error),
		error.message,
		unresolvedSession ? "Reconcile the acknowledged session before retrying" : recommendation,
	);
});

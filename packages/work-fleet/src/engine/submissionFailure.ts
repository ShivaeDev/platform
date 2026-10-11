import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { SessionFailure } from "#session/schema.ts";

export const submissionFailure = Effect.fn("Fleet.submissionFailure")(function* (
	state: EngineState,
	workId: string,
	operationId: string,
	error: SessionFailure,
	recommendation: string,
) {
	if (error.reason !== "rejected" && error.reason !== "unavailable") {
		return;
	}
	const current = yield* state.load(workId);
	const acknowledged = current.value.attempts.find((item) => item.operationId === operationId);
	const unresolvedSession = acknowledged?.receipt !== undefined || (error.reason === "unavailable" && acknowledged?.sessionId !== undefined);
	const attempts = current.value.attempts.map((item) =>
		item.operationId === operationId && !unresolvedSession ? { ...item, status: "failed" as const } : item,
	);
	yield* state.decision(
		yield* state.save(current, { ...current.value, attempts }),
		error.message,
		unresolvedSession ? "Reconcile the acknowledged session before retrying" : recommendation,
	);
});

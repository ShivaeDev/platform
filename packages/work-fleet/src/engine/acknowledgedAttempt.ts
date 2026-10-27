import type { Attempt } from "#model.ts";
import type { SessionReceipt } from "#session/schema.ts";

export function acknowledgedAttempt(attempt: Attempt, operationId: string, sessionId: string, now: number, receipt?: SessionReceipt): Attempt {
	if (attempt.operationId !== operationId) {
		return attempt;
	}
	if (receipt === undefined) {
		return { ...attempt, sessionId };
	}
	return {
		...attempt,
		receipt,
		sessionId,
		startedAt: attempt.startedAt ?? now,
		status: attempt.status === "submitting" ? "accepted" : attempt.status,
	};
}

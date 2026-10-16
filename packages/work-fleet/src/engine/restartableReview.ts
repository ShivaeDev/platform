import type { FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";

export function restartableReview(record: FleetRecord, error: unknown): error is SessionFailure {
	const attempt = record.attempts.at(-1);
	return (
		error instanceof SessionFailure
		&& record.stage === "reviewing"
		&& attempt?.role === "reviewer"
		&& attempt.status === "submitting"
		&& attempt.receipt === undefined
		&& (attempt.terminalReceipts?.length ?? 0) === 0
		&& error.reason === "ambiguous"
		&& error.code !== "duplicate-turns"
		&& (error.code === "session-turn-missing" || attempt.sessionId === undefined)
	);
}

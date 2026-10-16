import type { FleetRecord } from "#model.ts";
import { SessionFailure } from "#session/schema.ts";

export function lostReviewThread(record: FleetRecord, error: unknown): error is SessionFailure {
	const attempt = record.attempts.at(-1);
	return (
		error instanceof SessionFailure
		&& record.stage === "reviewing"
		&& attempt?.role === "reviewer"
		&& attempt.status === "submitting"
		&& attempt.sessionId === undefined
		&& attempt.receipt === undefined
		&& (attempt.terminalReceipts?.length ?? 0) === 0
		&& error.reason === "ambiguous"
		&& error.code !== "duplicate-turns"
	);
}

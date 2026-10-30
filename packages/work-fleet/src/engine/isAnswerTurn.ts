import type { Attempt, FleetRecord } from "#model.ts";
import { reportedQuestion } from "#prompt/worker.ts";

export function isAnswerTurn(record: FleetRecord, attempt: Attempt): boolean {
	if (attempt.answerTurn !== undefined) {
		return attempt.answerTurn;
	}
	const previous = record.attempts[record.attempts.findIndex((entry) => entry.operationId === attempt.operationId) - 1];
	return (
		previous?.receipt?.sessionId === attempt.sessionId
		&& previous?.status === "completed"
		&& reportedQuestion(previous.output ?? "") !== undefined
		&& record.responses?.some((response) => response.action === "continue") === true
	);
}

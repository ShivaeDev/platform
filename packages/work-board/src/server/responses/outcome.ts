import type { Reading } from "#browser/responses/schema.ts";

export function outcome(reading: Reading, after: string | undefined, now: number) {
	const at = after === undefined ? -1 : reading.responses.findIndex((candidate) => candidate.id === after);
	if (after !== undefined && at < 0) {
		return { kind: "missing_cursor" } as const;
	}
	const response = reading.responses[at + 1];
	if (response) {
		return { kind: "response", question: reading.question, response } as const;
	}
	return now >= reading.question.question.deadline
		? ({ kind: "unanswered", question: reading.question } as const)
		: ({ kind: "pending", question: reading.question } as const);
}

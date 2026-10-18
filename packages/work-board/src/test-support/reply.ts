import type { RecordedResponse } from "#browser/responses/schema.ts";

export function reply(id: string, author: string, recordedAt: number, supersedes?: string): RecordedResponse {
	return {
		body: id,
		id,
		response: { author, question: "question.example", recordedAt, reviewedRevision: "a".repeat(64), supersedes, type: "answer" },
	};
}

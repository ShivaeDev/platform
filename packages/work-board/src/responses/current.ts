import type { RecordedResponse } from "#browser/responses/schema.ts";

export function currentResponses(responses: readonly RecordedResponse[]): readonly RecordedResponse[] {
	const superseded = new Set(responses.flatMap((response) => (response.response.supersedes ? [response.response.supersedes] : [])));
	const latestByAuthor = new Map<string, RecordedResponse>();
	const ordered = responses.toSorted((a, b) => a.response.recordedAt - b.response.recordedAt || a.id.localeCompare(b.id));
	for (const response of ordered) {
		latestByAuthor.set(response.response.author, response);
	}
	return [...latestByAuthor.values()].filter((response) => !superseded.has(response.id));
}

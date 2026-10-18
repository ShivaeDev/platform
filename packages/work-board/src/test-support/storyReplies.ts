import type { RecordedResponse } from "#browser/responses/schema.ts";
import { currentResponses } from "#responses/current.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { responseFrom } from "#server/responses/records.ts";
import { type BoardEngine, savedResponseFiles } from "./storyEngine.ts";

export function reply(id: string, author: string, recordedAt: number, supersedes?: string): RecordedResponse {
	return {
		body: id,
		id,
		response: { author, question: "question.example", recordedAt, reviewedRevision: "a".repeat(64), supersedes, type: "answer" },
	};
}

export function currentReplies(engine: BoardEngine) {
	const records = savedResponseFiles(engine).flatMap(({ file, source }) => {
		const record = responseFrom({ file, modified: 0, parsed: metadataParse(source) });
		return record ? [record] : [];
	});
	return currentResponses(records);
}

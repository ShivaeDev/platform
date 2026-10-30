import type { Snapshot } from "#server/search/snapshot.ts";
import { questionSourceMatches } from "./questionSourceMatches.ts";
import { questionFrom } from "./records.ts";

export function openQuestions(data: Snapshot) {
	return data.documents.flatMap((document) => {
		const question = questionFrom(document);
		if (question === undefined) {
			return [];
		}
		const sources = data.model.ids.get(question.question.item);
		const source = sources?.length === 1 ? sources[0] : undefined;
		const request = source?.parsed.fields.attention?.find((candidate) => candidate.id === question.question.request);
		const open = request ? request.state === "open" : source?.parsed.fields.status !== "done" && source?.parsed.fields.status !== "dropped";
		return source && open && questionSourceMatches(question, source) ? [question] : [];
	});
}
